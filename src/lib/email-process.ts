import { prisma } from "@/lib/prisma";
import { parseFine } from "@/lib/fine-parser";
import { serverOcr } from "@/lib/server-ocr";
import { classifyDocument, detectSimpleExpediteur } from "@/lib/document-classifier";
import { parseMiseEnDemeure } from "@/lib/mise-en-demeure-parser";
import { detectOrganisme, buildTransmission } from "@/lib/transmission";
import { PUB_RETENTION_MINUTES } from "@/lib/courriers";

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
      // "Pub" is only ever reached when classifyDocument found clear commercial wording AND none
      // of the exclusion signals (URSSAF, facture, échéance, montant dû, juridique, etc.) — see
      // document-classifier.ts. Ambiguous mail simply falls through to "inconnu" below, unmodified.
      if (classification.type === "pub") {
        const classifiedAt = new Date();
        const expiresAt = new Date(classifiedAt.getTime() + PUB_RETENTION_MINUTES * 60000);

        const courrier = await prisma.courrier.create({
          data: {
            societe: scan.societe,
            type: "pub",
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
