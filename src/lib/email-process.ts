import { prisma } from "@/lib/prisma";
import { parseFine, findImmat } from "@/lib/fine-parser";
import { serverOcr } from "@/lib/server-ocr";
import { classifyDocument, detectSimpleExpediteur, isComptabiliteClassificationConfident } from "@/lib/document-classifier";
import { parseMiseEnDemeure } from "@/lib/mise-en-demeure-parser";
import { parseFacture, parseImpot } from "@/lib/comptabilite-parser";
import { parseSinistre } from "@/lib/sinistre-parser";
import { buildInitialForward } from "@/lib/comptabilite";
import { forwardComptabiliteDocument } from "@/lib/comptabilite-forward";
import { detectOrganisme, buildTransmission } from "@/lib/transmission";
import { PUB_RETENTION_MINUTES, normalizeImmatriculation } from "@/lib/courriers";

function log(msg: string) { console.log(`[EMAIL-SCAN] ${msg}`); }

export type ProcessScanResult = { id: string; status: string; error?: string };

// Extracted from api/scan-email/process route so the auto-poll scheduler can reuse it.
export async function processPendingEmailScans(id?: string): Promise<{ processed: number; results: ProcessScanResult[]; message?: string }> {
  const where = id ? { id, status: { in: ["received", "error"] } } : { status: "received" };
  const scans = await prisma.emailScan.findMany({
    where,
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  if (scans.length === 0) {
    return { processed: 0, results: [], message: "Aucun scan à traiter" };
  }

  let processed = 0;
  const results: ProcessScanResult[] = [];

  for (const scan of scans) {
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
        where: { societe: scan.societe },
        select: { immatriculation: true },
      }).then((vs) => vs.map((v) => v.immatriculation));

      // Classification layer: contravention hints always win (see document-classifier.ts), so this
      // can only ever redirect a scan away from the existing Contraventions pipeline when there is
      // zero contravention signal in the text — the logic below is otherwise entirely unchanged.
      const classification = classifyDocument(ocrText);
      if (classification.type === "mise_en_demeure") {
        const parsedMed = parseMiseEnDemeure(ocrText, scan.societe);
        const societeExists = await prisma.societe.findUnique({ where: { nom: scan.societe } });
        const statut = societeExists ? parsedMed.statut : "À vérifier";

        // Transmission-to-client architecture (URSSAF today, more organismes later): detection,
        // client identification and preparation only — sending stays entirely out of scope here.
        const organisme = detectOrganisme(ocrText, parsedMed.expediteur);
        const transmission = buildTransmission({
          organisme,
          societeConcernee: societeExists ? scan.societe : null,
          societeConnue: !!societeExists,
          identificationConfidence: parsedMed.confiance.sens,
          acteur: scan.societe,
          actionLabel: "Courrier re\u00e7u et analys\u00e9 automatiquement",
        });

        const courrier = await prisma.courrier.create({
          data: {
            societe: scan.societe,
            type: "mise_en_demeure",
            source: "EMAIL_SCAN",
            data: {
              ...parsedMed,
              societeConcernee: societeExists ? scan.societe : null,
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
              societe: scan.societe,
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
          where: { societe: scan.societe, reference: { startsWith: prefix } },
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
            societe: scan.societe,
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
            societe: scan.societe,
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
            societe: scan.societe,
            type: classification.type,
            source: "EMAIL_SCAN",
            data: {
              ...parsed,
              societeConcernee: scan.societe,
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
            await forwardComptabiliteDocument(courrier.id, scan.societe);
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
            societe: scan.societe,
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
            societe: scan.societe,
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
          where: { societe: scan.societe, numDossier: { startsWith: prefix } },
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
            where: { societe: scan.societe, immatriculation: parsed.immatriculation },
          });
          if (v) vehiculeId = v.id;
        }

        const contravention = await prisma.contravention.create({
          data: {
            societe: scan.societe,
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
          errorMessage: needsReview && contraventionId ? "À vérifier : données partiellement extraites" : null,
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
