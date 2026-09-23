import { prisma } from "@/lib/prisma";
import { parseFine, findImmat } from "@/lib/fine-parser";
import { serverOcr } from "@/lib/server-ocr";
import { classifyDocument, detectSimpleExpediteur, isComptabiliteClassificationConfident } from "@/lib/document-classifier";
import { parseMiseEnDemeure } from "@/lib/mise-en-demeure-parser";
import { parseFacture, parseImpot } from "@/lib/comptabilite-parser";
import { parseSinistre } from "@/lib/sinistre-parser";
import { parsePermisConduire, parseCarteIdentite } from "@/lib/identite-parser";
import { buildInitialForward } from "@/lib/comptabilite";
import { forwardComptabiliteDocument } from "@/lib/comptabilite-forward";
import { detectOrganisme, buildTransmission } from "@/lib/transmission";
import { PUB_RETENTION_MINUTES, normalizeImmatriculation } from "@/lib/courriers";
import { getEmailScanRecordHref } from "@/lib/scan-record-href";

function log(msg: string) { console.log(`[EMAIL-SCAN] ${msg}`); }

export type ProcessScanResult = { id: string; status: string; error?: string };

export { getEmailScanRecordHref } from "@/lib/scan-record-href";

const STALE_PROCESSING_MINUTES = 10;
const PROCESS_BATCH_SIZE = Math.max(1, parseInt(process.env.SCAN_PROCESS_BATCH_SIZE ?? "2", 10));
const PROCESS_MAX_DRAIN_CYCLES = Math.max(1, parseInt(process.env.SCAN_PROCESS_MAX_DRAIN_CYCLES ?? "6", 10));

async function resolveExistingSociete(preferred: string): Promise<string> {
  const exact = await prisma.societe.findFirst({
    where: { nom: { equals: preferred, mode: "insensitive" } },
    select: { nom: true },
  });
  if (exact?.nom) return exact.nom;

  const fallbacks = [process.env.ADMIN_SOCIETE?.trim(), process.env.SCAN_DEFAULT_SOCIETE?.trim()]
    .filter((name): name is string => !!name && name.length > 0);

  for (const candidate of fallbacks) {
    const hit = await prisma.societe.findFirst({
      where: { nom: { equals: candidate, mode: "insensitive" } },
      select: { nom: true },
    });
    if (hit?.nom) return hit.nom;
  }

  const first = await prisma.societe.findFirst({ orderBy: { createdAt: "asc" }, select: { nom: true } });
  if (first?.nom) return first.nom;
  throw new Error("Aucune société disponible pour traiter ce scan.");
}

// Extracted from api/scan-email/process route so the auto-poll scheduler can reuse it.
export async function processPendingEmailScans(id?: string): Promise<{ processed: number; results: ProcessScanResult[]; message?: string }> {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000);
  const where = id
    ? { id, status: { in: ["received", "error", "processing", "analyzed"] } }
    : {
      OR: [
        { status: "received" },
        { status: "error" },
        // If a previous run crashed mid-analysis, processing can stay stuck forever.
        // Requeue old processing rows automatically so they are never orphaned.
        { status: "processing", updatedAt: { lt: staleBefore } },
      ],
    };
  const scanRows = await prisma.emailScan.findMany({
    where,
    // Keep batches intentionally small: OCR on large PDFs can exceed serverless limits when
    // multiple files are processed in one request, which leaves rows stuck in "processing".
    take: id ? 1 : PROCESS_BATCH_SIZE,
    orderBy: { createdAt: "asc" },
    // `fileData` (Bytes) is deliberately EXCLUDED here and fetched separately below via raw SQL.
    // Root cause (2026-09-23): Prisma's typed Bytes<->N-API marshalling crashes specifically on
    // Vercel's serverless runtime ("Failed to convert rust `String` into napi `string`" / OOM),
    // even though the exact same query works fine locally against the same DB — this is what
    // silently broke the whole automatic scan pipeline (every scan stuck at "Reçu", OCR never
    // ran). `$queryRaw` returns the bytea column as a plain Buffer via the pg driver directly,
    // sidestepping that broken path entirely.
    select: { id: true, societe: true, fileName: true, fileMime: true, fileSize: true, receivedAt: true },
  });
  const scans = await Promise.all(
    scanRows.map(async (row) => {
      const raw = await prisma.$queryRaw<{ fileData: Buffer }[]>`SELECT "fileData" FROM "EmailScan" WHERE id = ${row.id}`;
      return { ...row, fileData: raw[0]?.fileData ?? Buffer.alloc(0) };
    })
  );

  if (scans.length === 0) {
    return { processed: 0, results: [], message: "Aucun scan à traiter" };
  }

  let processed = 0;
  const results: ProcessScanResult[] = [];

  for (const scan of scans) {
    const societe = await resolveExistingSociete(scan.societe);
    if (societe !== scan.societe) {
      log(`Société du scan corrigée automatiquement: "${scan.societe}" -> "${societe}" (${scan.fileName})`);
      await prisma.emailScan.update({
        where: { id: scan.id },
        data: { societe },
      });
    }

    log(`Analyse démarrée: ${scan.fileName}`);
    await prisma.emailScan.update({
      where: { id: scan.id },
      data: { status: "processing" },
    });

    try {
      const ocrText = await serverOcr(Buffer.from(scan.fileData), scan.fileMime);

      if (!ocrText || ocrText.replace(/\s/g, "").length < 10) {
        log(`Extraction texte insuffisante après OCR: ${scan.fileName}`);
        await prisma.emailScan.update({
          where: { id: scan.id },
          data: {
            status: "error",
            errorMessage: "Texte extrait insuffisant malgré OCR. Document illisible ou vide.",
            ocrText: ocrText || null,
            processedAt: new Date(),
          },
        });
        results.push({ id: scan.id, status: "error", error: "Document illisible" });
        continue;
      }

      const knownPlates = await prisma.vehicule.findMany({
        where: { societe },
        select: { immatriculation: true },
      }).then((vs) => vs.map((v) => v.immatriculation));

      // Classification layer: contravention hints always win (see document-classifier.ts), so this
      // can only ever redirect a scan away from the existing Contraventions pipeline when there is
      // zero contravention signal in the text — the logic below is otherwise entirely unchanged.
      const classification = classifyDocument(ocrText);
      if (classification.type === "mise_en_demeure") {
        const parsedMed = parseMiseEnDemeure(ocrText, societe);
        const societeExists = await prisma.societe.findUnique({ where: { nom: societe } });
        const statut = societeExists ? parsedMed.statut : "À vérifier";

        // Transmission-to-client architecture (URSSAF today, more organismes later): detection,
        // client identification and preparation only — sending stays entirely out of scope here.
        const organisme = detectOrganisme(ocrText, parsedMed.expediteur);
        const transmission = buildTransmission({
          organisme,
          societeConcernee: societeExists ? societe : null,
          societeConnue: !!societeExists,
          identificationConfidence: parsedMed.confiance.sens,
          acteur: societe,
          actionLabel: "Courrier re\u00e7u et analys\u00e9 automatiquement",
        });

        const courrier = await prisma.courrier.create({
          data: {
            societe,
            type: "mise_en_demeure",
            source: "EMAIL_SCAN",
            data: {
              ...parsedMed,
              societeConcernee: societeExists ? societe : null,
              statut,
              origine: "auto",
              transmission,
            },
            fileName: scan.fileName,
            fileMime: scan.fileMime,
            fileSize: scan.fileSize,
            fileData: scan.fileData,
            receivedAt: scan.receivedAt,
          },
        });

        await prisma.emailScan.update({
          where: { id: scan.id },
          data: {
            status: "created",
            ocrText,
            courrierId: courrier.id,
            processedAt: new Date(),
          },
        });

        log(`Mise en demeure d\u00e9tect\u00e9e et class\u00e9e (${statut}): ${scan.fileName} \u2192 courrier ${courrier.id}`);
        processed++;
        results.push({ id: scan.id, status: "created" });
        continue;
      }

      // Certificat d'immatriculation (2026-09-01): previously only wired up in the manual-import
      // pipeline — a carte grise arriving by e-mail/printer scan used to silently fall through to
      // the contravention parser below and get misfiled. Auto-classified only when a plate number
      // was actually found; otherwise falls through to "inconnu" (never guessed).
      if (classification.type === "certificat_immatriculation") {
        const immat = findImmat(ocrText);
        if (immat) {
          const courrier = await prisma.courrier.create({
            data: {
              societe,
              type: "certificat_immatriculation",
              source: "EMAIL_SCAN",
              data: { immatriculation: normalizeImmatriculation(immat) },
              fileName: scan.fileName,
              fileMime: scan.fileMime,
              fileSize: scan.fileSize,
              fileData: scan.fileData,
              receivedAt: scan.receivedAt,
            },
          });

          await prisma.emailScan.update({
            where: { id: scan.id },
            data: { status: "created", ocrText, courrierId: courrier.id, processedAt: new Date() },
          });

          log(`Certificat d'immatriculation détecté: ${scan.fileName} → courrier ${courrier.id}`);
          processed++;
          results.push({ id: scan.id, status: "created" });
          continue;
        }

        await prisma.emailScan.update({
          where: { id: scan.id },
          data: {
            status: "analyzed",
            ocrText,
            errorMessage: "À vérifier : certificat d'immatriculation détecté mais immatriculation introuvable.",
            processedAt: new Date(),
          },
        });

        log(`Certificat d'immatriculation détecté sans plaque lisible: ${scan.fileName} → à vérifier`);
        processed++;
        results.push({ id: scan.id, status: "analyzed" });
        continue;
      }

      // Sinistre (accident/déclaration d'assurance, 2026-09-01): creates a dossier straight away
      // (statut "À vérifier" — an accident dossier always needs a human review before it's
      // considered final) with whatever fields the extractor found, and attaches the scanned
      // document to it exactly like the manual "Ajouter un document" flow does.
      if (classification.type === "sinistre") {
        const parsedSinistre = parseSinistre(ocrText);
        const year = new Date().getFullYear();
        const prefix = `SIN-${year}-`;
        const lastSinistre = await prisma.sinistre.findFirst({
          where: { societe, reference: { startsWith: prefix } },
          orderBy: { reference: "desc" },
        });
        let n = 1;
        if (lastSinistre) {
          const m = lastSinistre.reference.match(/(\d+)$/);
          if (m) n = parseInt(m[1], 10) + 1;
        }
        const reference = `${prefix}${String(n).padStart(4, "0")}`;

        const sinistre = await prisma.sinistre.create({
          data: {
            reference,
            societe,
            statut: "À vérifier",
            origine: "auto",
            typeSinistre: parsedSinistre.typeSinistre,
            dateSinistre: parsedSinistre.dateSinistre,
            lieuSinistre: parsedSinistre.lieuSinistre,
            assureur: parsedSinistre.assureur,
            referenceAssureur: parsedSinistre.referenceAssureur,
            montantDommage: parsedSinistre.montantDommage,
          },
        });
        await prisma.sinistreHistorique.create({
          data: { sinistreId: sinistre.id, action: "document_recu", details: `Document reçu par e-mail (${scan.fileName})`, acteur: "Système" },
        });
        await prisma.sinistreHistorique.create({
          data: { sinistreId: sinistre.id, action: "classification_auto", details: "Classé automatiquement comme sinistre", acteur: "Système" },
        });

        const courrier = await prisma.courrier.create({
          data: {
            societe,
            type: "sinistre",
            source: "EMAIL_SCAN",
            sinistreId: sinistre.id,
            data: {},
            fileName: scan.fileName,
            fileMime: scan.fileMime,
            fileSize: scan.fileSize,
            fileData: scan.fileData,
            receivedAt: scan.receivedAt,
          },
        });

        await prisma.emailScan.update({
          where: { id: scan.id },
          data: { status: "created", ocrText, courrierId: courrier.id, processedAt: new Date() },
        });

        log(`Sinistre détecté et classé (À vérifier): ${scan.fileName} → dossier ${reference}`);
        processed++;
        results.push({ id: scan.id, status: "created" });
        continue;
      }

      if (classification.type === "permis_conduire") {
        const parsedPermis = parsePermisConduire(ocrText);
        const courrier = await prisma.courrier.create({
          data: {
            societe,
            type: "permis_conduire",
            source: "EMAIL_SCAN",
            data: {
              numPermis: parsedPermis.numPermis,
              dateDelivrance: parsedPermis.dateDelivrance,
              dateExpiration: parsedPermis.dateExpiration,
              origine: "auto",
            },
            fileName: scan.fileName,
            fileMime: scan.fileMime,
            fileSize: scan.fileSize,
            fileData: scan.fileData,
            receivedAt: scan.receivedAt,
          },
        });

        await prisma.emailScan.update({
          where: { id: scan.id },
          data: {
            status: "created",
            ocrText,
            courrierId: courrier.id,
            errorMessage: "À vérifier : associer ce permis au bon conducteur.",
            processedAt: new Date(),
          },
        });

        log(`Permis de conduire détecté: ${scan.fileName} → courrier ${courrier.id} (à vérifier)`);
        processed++;
        results.push({ id: scan.id, status: "created" });
        continue;
      }

      if (classification.type === "carte_identite") {
        const parsedIdentite = parseCarteIdentite(ocrText);
        const courrier = await prisma.courrier.create({
          data: {
            societe,
            type: "carte_identite",
            source: "EMAIL_SCAN",
            data: {
              numCarteIdentite: parsedIdentite.numCarteIdentite,
              dateDelivrance: parsedIdentite.dateDelivrance,
              dateExpiration: parsedIdentite.dateExpiration,
              origine: "auto",
            },
            fileName: scan.fileName,
            fileMime: scan.fileMime,
            fileSize: scan.fileSize,
            fileData: scan.fileData,
            receivedAt: scan.receivedAt,
          },
        });

        await prisma.emailScan.update({
          where: { id: scan.id },
          data: {
            status: "created",
            ocrText,
            courrierId: courrier.id,
            errorMessage: "À vérifier : associer cette pièce d'identité au bon conducteur.",
            processedAt: new Date(),
          },
        });

        log(`Carte d'identité détectée: ${scan.fileName} → courrier ${courrier.id} (à vérifier)`);
        processed++;
        results.push({ id: scan.id, status: "created" });
        continue;
      }

      // Facture / Impôt: auto-forwarded by e-mail to the accounting team, but only when the
      // classification is confident enough (see isComptabiliteClassificationConfident) — an
      // ambiguous document is still filed under Comptabilité but stays "À vérifier" and nothing
      // is ever sent for it automatically.
      if (classification.type === "facture" || classification.type === "impot") {
        const confident = isComptabiliteClassificationConfident(classification.score, classification.competingScore ?? 0);
        const statutClassification = confident ? "Nouveau" : "À vérifier";
        const forward = buildInitialForward(confident ? "À transmettre" : "À vérifier", "document_recu");
        const parsed = classification.type === "facture" ? parseFacture(ocrText) : parseImpot(ocrText);

        const courrier = await prisma.courrier.create({
          data: {
            societe,
            type: classification.type,
            source: "EMAIL_SCAN",
            data: {
              ...parsed,
              societeConcernee: societe,
              statutClassification,
              origine: "auto",
              forward,
            },
            fileName: scan.fileName,
            fileMime: scan.fileMime,
            fileSize: scan.fileSize,
            fileData: scan.fileData,
            receivedAt: scan.receivedAt,
          },
        });

        await prisma.emailScan.update({
          where: { id: scan.id },
          data: { status: "created", ocrText, courrierId: courrier.id, processedAt: new Date() },
        });

        log(`${classification.type === "facture" ? "Facture" : "Document fiscal"} détecté(e) (${statutClassification}): ${scan.fileName} → courrier ${courrier.id}`);

        if (confident) {
          try {
            await forwardComptabiliteDocument(courrier.id, societe);
          } catch (e) {
            log(`Erreur transmission automatique (non bloquant, document conservé): ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        processed++;
        results.push({ id: scan.id, status: "created" });
        continue;
      }      // "Pub" is only ever reached when classifyDocument found clear commercial wording AND none
      // of the exclusion signals (URSSAF, facture, échéance, montant dû, juridique, etc.) — see
      // document-classifier.ts. Ambiguous mail simply falls through to "inconnu" below, unmodified.
      if (classification.type === "pub") {
        const classifiedAt = new Date();
        const expiresAt = new Date(classifiedAt.getTime() + PUB_RETENTION_MINUTES * 60000);

        const courrier = await prisma.courrier.create({
          data: {
            societe,
            type: "pub",
            source: "EMAIL_SCAN",
            data: {
              expediteur: detectSimpleExpediteur(ocrText),
              classifiedAt: classifiedAt.toISOString(),
              conserve: false,
            },
            fileName: scan.fileName,
            fileMime: scan.fileMime,
            fileSize: scan.fileSize,
            fileData: scan.fileData,
            receivedAt: scan.receivedAt,
            expiresAt,
          },
        });

        await prisma.emailScan.update({
          where: { id: scan.id },
          data: {
            status: "created",
            ocrText,
            courrierId: courrier.id,
            processedAt: new Date(),
          },
        });

        log(`Publicité détectée: ${scan.fileName} → courrier ${courrier.id} (suppression prévue à ${expiresAt.toLocaleTimeString("fr-FR")})`);
        processed++;
        results.push({ id: scan.id, status: "created" });
        continue;
      }
      const parsed = parseFine(ocrText, knownPlates);
      const parsedJson = JSON.stringify(parsed);

      // Check for duplicates by numAvis + immatriculation + dateInfraction
      if (parsed.numAvis) {
        const duplicate = await prisma.contravention.findFirst({
          where: {
            societe,
            numAvis: parsed.numAvis,
          },
        });
        if (duplicate) {
          log(`Doublon détecté (numAvis ${parsed.numAvis} déjà existant): ${scan.fileName}`);
          await prisma.emailScan.update({
            where: { id: scan.id },
            data: {
              status: "error",
              ocrText,
              parsedData: parsedJson,
              errorMessage: `Doublon : contravention existante avec le même n° d'avis (${parsed.numAvis}), dossier ${duplicate.numDossier}`,
              processedAt: new Date(),
            },
          });
          results.push({ id: scan.id, status: "error", error: "Doublon détecté" });
          continue;
        }
      }

      // Determine confidence: if key fields are missing, mark as "à vérifier"
      const hasEssentialData = !!(parsed.numAvis || parsed.dateInfraction || parsed.immatriculation || parsed.montantAmende);
      const fieldCount = [parsed.numAvis, parsed.dateInfraction, parsed.immatriculation, parsed.montantAmende, parsed.natureInfraction].filter(Boolean).length;
      const needsReview = fieldCount < 3;

      let contraventionId: string | null = null;
      if (hasEssentialData) {
        const year = new Date().getFullYear();
        const prefix = `PV-${year}-`;
        const last = await prisma.contravention.findFirst({
          where: { societe, numDossier: { startsWith: prefix } },
          orderBy: { numDossier: "desc" },
        });
        let n = 1;
        if (last) {
          const m = last.numDossier.match(/(\d+)$/);
          if (m) n = parseInt(m[1], 10) + 1;
        }
        const numDossier = `${prefix}${String(n).padStart(3, "0")}`;

        let vehiculeId: string | null = null;
        if (parsed.immatriculation) {
          const v = await prisma.vehicule.findFirst({
            where: { societe, immatriculation: parsed.immatriculation },
          });
          if (v) vehiculeId = v.id;
        }

        const contravention = await prisma.contravention.create({
          data: {
            societe,
            numDossier,
            numAvis: parsed.numAvis ?? null,
            dateInfraction: parsed.dateInfraction ?? null,
            heureInfraction: parsed.heureInfraction ?? null,
            natureInfraction: parsed.natureInfraction ?? null,
            lieuInfraction: parsed.lieuInfraction ?? null,
            vitesseConstatee: parsed.vitesseConstatee ?? null,
            vitesseAutorisee: parsed.vitesseAutorisee ?? null,
            montantAmende: parsed.montantAmende ?? null,
            pointsRetires: parsed.pointsRetires ?? 0,
            dateLimitePaiement: parsed.dateLimitePaiement ?? null,
            immatriculationOcr: parsed.immatriculation ?? null,
            vehiculeId,
            rawOcrText: ocrText,
            observations: needsReview ? "⚠️ À vérifier — certaines informations n'ont pas pu être extraites avec certitude." : null,
          },
        });
        contraventionId = contravention.id;

        if (needsReview) {
          log(`Document à vérifier (données partielles): ${scan.fileName} → dossier ${numDossier}`);
        } else {
          log(`Contravention créée: ${scan.fileName} → dossier ${numDossier}`);
        }
      } else {
        log(`Analyse terminée mais pas assez d'informations pour créer un dossier: ${scan.fileName}`);
      }

      await prisma.emailScan.update({
        where: { id: scan.id },
        data: {
          status: contraventionId ? "created" : "analyzed",
          ocrText,
          parsedData: parsedJson,
          contraventionId,
          errorMessage: needsReview && contraventionId
            ? "À vérifier : données partiellement extraites"
            : (!contraventionId ? "À vérifier : type incertain ou données insuffisantes pour créer un dossier." : null),
          processedAt: new Date(),
        },
      });

      processed++;
      results.push({ id: scan.id, status: contraventionId ? "created" : "analyzed" });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      await prisma.emailScan.update({
        where: { id: scan.id },
        data: { status: "error", errorMessage, processedAt: new Date() },
      });
      results.push({ id: scan.id, status: "error", error: errorMessage });
    }
  }

  return { processed, results };
}

// Repeatedly runs small OCR batches in one request to clear a backlog faster while
// still respecting PROCESS_BATCH_SIZE and avoiding a single giant long-running batch.
export async function drainPendingEmailScans(): Promise<{ processed: number; cycles: number; results: ProcessScanResult[]; message?: string }> {
  let totalProcessed = 0;
  let cycles = 0;
  const allResults: ProcessScanResult[] = [];

  while (cycles < PROCESS_MAX_DRAIN_CYCLES) {
    const batch = await processPendingEmailScans();
    cycles += 1;
    totalProcessed += batch.processed;
    allResults.push(...batch.results);

    if (batch.processed === 0) {
      return {
        processed: totalProcessed,
        cycles,
        results: allResults,
        message: totalProcessed === 0 ? (batch.message ?? "Aucun scan à traiter") : "Tous les scans en attente ont été traités.",
      };
    }
  }

  return {
    processed: totalProcessed,
    cycles,
    results: allResults,
    message: `Limite atteinte (${PROCESS_MAX_DRAIN_CYCLES} cycle(s)). Relancez pour vider le reste si nécessaire.`,
  };
}
