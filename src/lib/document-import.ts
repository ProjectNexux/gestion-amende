import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { classifyDocument, detectSimpleExpediteur, isComptabiliteClassificationConfident, type DocumentType } from "@/lib/document-classifier";
import { parseFine, findImmat, type ParsedFine } from "@/lib/fine-parser";
import { parseMiseEnDemeure } from "@/lib/mise-en-demeure-parser";
import { parseFacture, parseImpot } from "@/lib/comptabilite-parser";
import { parseSinistre } from "@/lib/sinistre-parser";
import { parsePermisConduire, parseCarteIdentite } from "@/lib/identite-parser";
import { buildInitialForward } from "@/lib/comptabilite";
import { detectOrganisme, buildTransmission } from "@/lib/transmission";
import { normalizeImmatriculation, getImmatriculation, courrierTypeLabel, PUB_RETENTION_MINUTES } from "@/lib/courriers";
import { RECLASS_OPTIONS, DOCUMENT_TYPE_LABELS, DOCUMENT_FIELD_LABELS } from "@/lib/document-labels-shared";

// Re-exported so existing server-side importers (API routes) keep working unchanged — the
// canonical, prisma-free definitions now live in document-labels-shared.ts (safe to import from
// "use client" components too, see that file's header comment).
export { RECLASS_OPTIONS, DOCUMENT_TYPE_LABELS, DOCUMENT_FIELD_LABELS };

/**
 * Universal "+ Nouveau document" pipeline (2026-08-24).
 *
 * Reuses, unmodified, the exact same building blocks as the e-mail/scanner pipeline
 * (src/lib/email-process.ts): serverOcr() for text extraction, classifyDocument() for typing,
 * and each type's dedicated parser (parseFine / parseMiseEnDemeure / parseFacture / parseImpot).
 * email-process.ts itself is left untouched — this module is a SEPARATE orchestrator built on
 * top of the same shared primitives, so the existing scan-email pipeline carries zero regression
 * risk (see repo memory / final report for the non-regression verification).
 *
 * Key difference from the e-mail pipeline: nothing is ever written to Contravention/Courrier/
 * Sinistre until a human explicitly confirms (see `commitDocumentAnalysis`) — analysis alone
 * never finalizes a classification.
 */

export type ConfidenceLabel = "Élevée" | "Moyenne" | "Faible";

export type DocumentFields = Record<string, string | number | null>;

export type DocumentAnalysis = {
  type: DocumentType;
  confidenceLabel: ConfidenceLabel;
  confidenceScore: number; // 0-1
  fields: DocumentFields;
};

export type DuplicateMatch = { kind: "hash" | "numAvis" | "immatriculation" | "reference"; id: string; label: string } | null;

export function fileHash(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Pure analysis — no DB writes. Mirrors the classification/confidence rules already used by email-process.ts. */
export function analyzeDocumentText(ocrText: string, societe: string, knownPlates: string[] = []): DocumentAnalysis {
  const classification = classifyDocument(ocrText);

  if (classification.type === "mise_en_demeure") {
    const parsed = parseMiseEnDemeure(ocrText, societe);
    const label: ConfidenceLabel = parsed.statut === "Nouveau" ? (parsed.confiance.sens >= 0.8 ? "Élevée" : "Moyenne") : "Faible";
    return {
      type: "mise_en_demeure",
      confidenceLabel: label,
      confidenceScore: parsed.confiance.sens,
      fields: {
        expediteur: parsed.expediteur,
        destinataire: parsed.destinataire,
        sens: parsed.sens,
        motif: parsed.motif,
        dateDocument: parsed.dateDocument,
        montant: parsed.montant,
        echeance: parsed.echeance,
        reference: parsed.reference,
      },
    };
  }

  if (classification.type === "facture" || classification.type === "impot") {
    const confident = isComptabiliteClassificationConfident(classification.score, classification.competingScore ?? 0);
    const label: ConfidenceLabel = confident ? "Élevée" : "Moyenne";
    if (classification.type === "facture") {
      const parsed = parseFacture(ocrText);
      return {
        type: "facture",
        confidenceLabel: label,
        confidenceScore: confident ? 0.9 : 0.5,
        fields: { emetteur: parsed.emetteur, dateDocument: parsed.dateDocument, montant: parsed.montant, reference: parsed.reference },
      };
    }
    const parsed = parseImpot(ocrText);
    return {
      type: "impot",
      confidenceLabel: label,
      confidenceScore: confident ? 0.9 : 0.5,
      fields: {
        typeDocument: parsed.typeDocument,
        organisme: parsed.organisme,
        dateDocument: parsed.dateDocument,
        montant: parsed.montant,
        echeance: parsed.echeance,
        reference: parsed.reference,
      },
    };
  }

  if (classification.type === "pub") {
    // Never a high-confidence auto-finalize target for manual import — always requires a human
    // to confirm ("reste prudent" — see spec §10), unlike the e-mail pipeline which auto-creates it.
    return { type: "pub", confidenceLabel: "Moyenne", confidenceScore: 0.5, fields: { expediteur: detectSimpleExpediteur(ocrText) } };
  }

  if (classification.type === "certificat_immatriculation") {
    const immat = findImmat(ocrText);
    return {
      type: "certificat_immatriculation",
      confidenceLabel: immat ? "Élevée" : "Moyenne",
      confidenceScore: immat ? 0.9 : 0.4,
      fields: { immatriculation: immat ? normalizeImmatriculation(immat) : null },
    };
  }

  if (classification.type === "sinistre") {
    const parsed = parseSinistre(ocrText);
    const fieldCount = [parsed.typeSinistre, parsed.dateSinistre, parsed.lieuSinistre, parsed.assureur, parsed.referenceAssureur].filter(Boolean).length;
    const label: ConfidenceLabel = fieldCount >= 3 ? "Élevée" : fieldCount >= 1 ? "Moyenne" : "Faible";
    return {
      type: "sinistre",
      confidenceLabel: label,
      confidenceScore: fieldCount / 5,
      fields: {
        typeSinistre: parsed.typeSinistre,
        dateSinistre: parsed.dateSinistre,
        lieuSinistre: parsed.lieuSinistre,
        assureur: parsed.assureur,
        referenceAssureur: parsed.referenceAssureur,
        montantDommage: parsed.montantDommage,
      },
    };
  }

  if (classification.type === "permis_conduire") {
    const parsed = parsePermisConduire(ocrText);
    const fieldCount = [parsed.numPermis, parsed.dateDelivrance, parsed.dateExpiration].filter(Boolean).length;
    return {
      type: "permis_conduire",
      confidenceLabel: fieldCount >= 2 ? "Élevée" : fieldCount >= 1 ? "Moyenne" : "Faible",
      confidenceScore: fieldCount / 3,
      fields: { numPermis: parsed.numPermis, dateDelivrance: parsed.dateDelivrance, dateExpiration: parsed.dateExpiration },
    };
  }

  if (classification.type === "carte_identite") {
    const parsed = parseCarteIdentite(ocrText);
    const fieldCount = [parsed.numCarteIdentite, parsed.dateDelivrance, parsed.dateExpiration].filter(Boolean).length;
    return {
      type: "carte_identite",
      confidenceLabel: fieldCount >= 2 ? "Élevée" : fieldCount >= 1 ? "Moyenne" : "Faible",
      confidenceScore: fieldCount / 3,
      fields: { numCarteIdentite: parsed.numCarteIdentite, dateDelivrance: parsed.dateDelivrance, dateExpiration: parsed.dateExpiration },
    };
  }

  // "contravention" or "inconnu": same essential-data rule as email-process.ts. A document
  // classified "contravention" but missing all essential fields is downgraded to "inconnu"
  // here (manual-import only — never changes what the e-mail pipeline does).
  const parsed: ParsedFine = parseFine(ocrText, knownPlates);
  const hasEssentialData = !!(parsed.numAvis || parsed.dateInfraction || parsed.immatriculation || parsed.montantAmende);
  const fieldCount = [parsed.numAvis, parsed.dateInfraction, parsed.immatriculation, parsed.montantAmende, parsed.natureInfraction].filter(Boolean).length;

  if (classification.type === "contravention" && hasEssentialData) {
    const label: ConfidenceLabel = fieldCount >= 4 ? "Élevée" : fieldCount === 3 ? "Moyenne" : "Faible";
    return {
      type: "contravention",
      confidenceLabel: label,
      confidenceScore: fieldCount / 5,
      fields: {
        numAvis: parsed.numAvis ?? null,
        dateInfraction: parsed.dateInfraction ?? null,
        immatriculation: parsed.immatriculation ?? null,
        natureInfraction: parsed.natureInfraction ?? null,
        lieuInfraction: parsed.lieuInfraction ?? null,
        montantAmende: parsed.montantAmende ?? null,
        dateLimitePaiement: parsed.dateLimitePaiement ?? null,
      },
    };
  }

  return { type: "inconnu", confidenceLabel: "Faible", confidenceScore: 0, fields: {} };
}

/** Read-only duplicate check, using the same identifiers already used elsewhere in the app for each type. */
export async function findPotentialDuplicate(analysis: DocumentAnalysis, societe: string): Promise<DuplicateMatch> {
  if (analysis.type === "contravention" && analysis.fields.numAvis) {
    const existing = await prisma.contravention.findFirst({ where: { societe, numAvis: analysis.fields.numAvis as string } });
    if (existing) return { kind: "numAvis", id: existing.id, label: `Contravention — dossier ${existing.numDossier}` };
  }

  if (analysis.type === "certificat_immatriculation" && analysis.fields.immatriculation) {
    const candidates = await prisma.courrier.findMany({ where: { societe, type: "certificat_immatriculation" } });
    const match = candidates.find((c) => getImmatriculation(c.data) === analysis.fields.immatriculation);
    if (match) return { kind: "immatriculation", id: match.id, label: `Certificat d'immatriculation — ${analysis.fields.immatriculation}` };
  }

  if ((analysis.type === "mise_en_demeure" || analysis.type === "facture" || analysis.type === "impot") && analysis.fields.reference) {
    const candidates = await prisma.courrier.findMany({ where: { societe, type: analysis.type } });
    const match = candidates.find((c) => {
      const d = c.data as Record<string, unknown>;
      return typeof d.reference === "string" && d.reference === analysis.fields.reference;
    });
    if (match) return { kind: "reference", id: match.id, label: `${courrierTypeLabel(analysis.type)} — réf. ${analysis.fields.reference}` };
  }

  return null;
}

async function nextContraventionNumDossier(societe: string): Promise<string> {
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
  return `${prefix}${String(n).padStart(3, "0")}`;
}

async function nextSinistreReference(societe: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SIN-${year}-`;
  const last = await prisma.sinistre.findFirst({
    where: { societe, reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
  });
  let n = 1;
  if (last) {
    const m = last.reference.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export type DuplicateAction = "ignorer" | "rattacher" | "creer_quand_meme";

export type CommitResult = { status: "created" | "linked" | "ignored"; recordId?: string; redirectPath?: string };

/**
 * Finalizes a manually-imported EmailScan row: creates the target record (or links to an
 * existing duplicate, or discards), then marks the scan "created"/"error" accordingly.
 * Never wraps everything in one giant transaction — a failure here simply leaves the scan
 * row itself intact (status stays "analyzed"), so the original document is never lost.
 *
 * `ownerSociete` is only used to look up/own the EmailScan row (the société that uploaded the
 * document). `opts.targetSociete` (2026-09-01, "envoyer vers l'espace client" feature) is the
 * société the FINAL record actually belongs to — chosen by an admin after analysis, defaults to
 * `ownerSociete` when absent so every pre-existing caller keeps its old behavior unchanged.
 */
export async function commitDocumentAnalysis(
  scanId: string,
  ownerSociete: string,
  opts: {
    finalType: string;
    fields: DocumentFields;
    duplicate: DuplicateMatch;
    duplicateAction: DuplicateAction;
    targetSociete?: string;
    visibleClient?: boolean;
  },
): Promise<CommitResult> {
  const scan = await prisma.emailScan.findFirst({ where: { id: scanId, societe: ownerSociete } });
  if (!scan) throw new Error("Document introuvable.");
  const societe = opts.targetSociete ?? ownerSociete;
  const visibleClient = opts.visibleClient ?? false;

  if (opts.duplicate && opts.duplicateAction === "ignorer") {
    await prisma.emailScan.update({
      where: { id: scanId },
      data: { status: "error", errorMessage: "Doublon ignoré par l'utilisateur.", processedAt: new Date() },
    });
    return { status: "ignored" };
  }

  if (opts.duplicate && opts.duplicateAction === "rattacher") {
    const isContravention = opts.duplicate.kind === "numAvis";
    await prisma.emailScan.update({
      where: { id: scanId },
      data: {
        status: "created",
        contraventionId: isContravention ? opts.duplicate.id : null,
        courrierId: isContravention ? null : opts.duplicate.id,
        processedAt: new Date(),
      },
    });
    return { status: "linked", recordId: opts.duplicate.id };
  }

  const f = opts.fields;
  const str = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? null : String(v));
  const num = (v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return Number.isNaN(n) ? null : n;
  };

  switch (opts.finalType) {
    case "contravention": {
      const numDossier = await nextContraventionNumDossier(societe);
      let vehiculeId: string | null = null;
      const immat = str(f.immatriculation);
      if (immat) {
        const v = await prisma.vehicule.findFirst({ where: { societe, immatriculation: immat } });
        if (v) vehiculeId = v.id;
      }
      const contravention = await prisma.contravention.create({
        data: {
          societe,
          numDossier,
          numAvis: str(f.numAvis),
          dateInfraction: str(f.dateInfraction),
          natureInfraction: str(f.natureInfraction),
          lieuInfraction: str(f.lieuInfraction),
          montantAmende: num(f.montantAmende),
          dateLimitePaiement: str(f.dateLimitePaiement),
          immatriculationOcr: immat,
          vehiculeId,
          rawOcrText: scan.ocrText,
          visibleClient,
        },
      });
      await prisma.emailScan.update({ where: { id: scanId }, data: { status: "created", contraventionId: contravention.id, processedAt: new Date() } });
      return { status: "created", recordId: contravention.id, redirectPath: `/contraventions/${contravention.id}` };
    }

    case "mise_en_demeure": {
      const expediteur = str(f.expediteur);
      const organisme = detectOrganisme(ocrTextSafe(scan.ocrText), expediteur);
      const societeExists = await prisma.societe.findUnique({ where: { nom: societe } });
      const transmission = buildTransmission({
        organisme,
        societeConcernee: societeExists ? societe : null,
        societeConnue: !!societeExists,
        identificationConfidence: 1, // reviewed/confirmed by a human before this write happens
        acteur: societe,
        actionLabel: "Import manuel confirmé par l'utilisateur",
      });
      const courrier = await prisma.courrier.create({
        data: {
          societe,
          type: "mise_en_demeure",
          source: "IMPORT",
          data: {
            expediteur,
            destinataire: str(f.destinataire),
            sens: str(f.sens) ?? "recue",
            societeConcernee: societeExists ? societe : null,
            motif: str(f.motif),
            motifBrut: null,
            dateDocument: str(f.dateDocument),
            echeance: str(f.echeance),
            echeanceTexte: null,
            montant: num(f.montant),
            montantIncertain: f.montant == null,
            reference: str(f.reference),
            confiance: { expediteur: 1, destinataire: 1, date: 1, motif: 1, montant: 1, echeance: 1, sens: 1 },
            statut: societeExists ? "Nouveau" : "À vérifier",
            origine: "auto",
            transmission,
          },
          fileName: scan.fileName,
          fileMime: scan.fileMime,
          fileSize: scan.fileSize,
          fileData: scan.fileData,
          receivedAt: scan.receivedAt,
          visibleClient,
        },
      });
      await prisma.emailScan.update({ where: { id: scanId }, data: { status: "created", courrierId: courrier.id, processedAt: new Date() } });
      return { status: "created", recordId: courrier.id, redirectPath: `/courriers/mise-en-demeure/${courrier.id}` };
    }

    case "facture":
    case "impot": {
      const forward = buildInitialForward("Non transmis", "Import manuel confirmé par l'utilisateur");
      const data =
        opts.finalType === "facture"
          ? { emetteur: str(f.emetteur), dateDocument: str(f.dateDocument), montant: num(f.montant), reference: str(f.reference) }
          : {
              typeDocument: str(f.typeDocument),
              organisme: str(f.organisme),
              dateDocument: str(f.dateDocument),
              montant: num(f.montant),
              echeance: str(f.echeance),
              reference: str(f.reference),
            };
      const courrier = await prisma.courrier.create({
        data: {
          societe,
          type: opts.finalType,
          source: "IMPORT",
          data: { ...data, societeConcernee: societe, statutClassification: "Nouveau", origine: "auto", forward },
          fileName: scan.fileName,
          fileMime: scan.fileMime,
          fileSize: scan.fileSize,
          fileData: scan.fileData,
          receivedAt: scan.receivedAt,
          visibleClient,
        },
      });
      await prisma.emailScan.update({ where: { id: scanId }, data: { status: "created", courrierId: courrier.id, processedAt: new Date() } });
      return {
        status: "created",
        recordId: courrier.id,
        redirectPath: opts.finalType === "facture" ? `/comptabilite/factures/${courrier.id}` : `/comptabilite/impots/${courrier.id}`,
      };
    }

    case "certificat_immatriculation": {
      const immatriculation = str(f.immatriculation);
      if (!immatriculation) throw new Error("Immatriculation manquante — merci de la renseigner avant de valider.");
      const courrier = await prisma.courrier.create({
        data: {
          societe,
          type: "certificat_immatriculation",
          source: "IMPORT",
          data: { immatriculation: normalizeImmatriculation(immatriculation) },
          fileName: scan.fileName,
          fileMime: scan.fileMime,
          fileSize: scan.fileSize,
          fileData: scan.fileData,
          receivedAt: scan.receivedAt,
          visibleClient,
        },
      });
      await prisma.emailScan.update({ where: { id: scanId }, data: { status: "created", courrierId: courrier.id, processedAt: new Date() } });
      return { status: "created", recordId: courrier.id, redirectPath: `/courriers/certificats-immatriculation/${courrier.id}` };
    }

    case "pub": {
      const classifiedAt = new Date();
      const expiresAt = new Date(classifiedAt.getTime() + PUB_RETENTION_MINUTES * 60000);
      const courrier = await prisma.courrier.create({
        data: {
          societe,
          type: "pub",
          source: "IMPORT",
          data: { expediteur: str(f.expediteur), classifiedAt: classifiedAt.toISOString(), conserve: false },
          fileName: scan.fileName,
          fileMime: scan.fileMime,
          fileSize: scan.fileSize,
          fileData: scan.fileData,
          receivedAt: scan.receivedAt,
          expiresAt,
        },
      });
      await prisma.emailScan.update({ where: { id: scanId }, data: { status: "created", courrierId: courrier.id, processedAt: new Date() } });
      return { status: "created", recordId: courrier.id, redirectPath: `/courriers/pub` };
    }

    // Sinistre now has a real OCR extractor (see sinistre-parser.ts) — fields are pre-filled when
    // found, but the dossier still lands in "À vérifier" so a human always confirms before it's
    // treated as final (accident/insurance dossiers are too consequential to auto-finalize).
    case "sinistre": {
      const reference = await nextSinistreReference(societe);
      const sinistre = await prisma.sinistre.create({
        data: {
          reference,
          societe,
          statut: "À vérifier",
          origine: "manuel",
          typeSinistre: str(f.typeSinistre),
          dateSinistre: str(f.dateSinistre),
          lieuSinistre: str(f.lieuSinistre),
          assureur: str(f.assureur),
          referenceAssureur: str(f.referenceAssureur),
          montantDommage: num(f.montantDommage),
        },
      });
      await prisma.sinistreHistorique.create({
        data: { sinistreId: sinistre.id, action: "document_recu", details: `Document importé manuellement (${scan.fileName})`, acteur: societe },
      });
      if (f.typeSinistre || f.dateSinistre || f.assureur) {
        await prisma.sinistreHistorique.create({
          data: { sinistreId: sinistre.id, action: "extraction", details: "Informations extraites automatiquement du document (OCR)", acteur: societe },
        });
      }
      const courrier = await prisma.courrier.create({
        data: {
          societe,
          type: "sinistre",
          source: "IMPORT",
          sinistreId: sinistre.id,
          data: {},
          fileName: scan.fileName,
          fileMime: scan.fileMime,
          fileSize: scan.fileSize,
          fileData: scan.fileData,
          receivedAt: scan.receivedAt,
          visibleClient,
        },
      });
      await prisma.emailScan.update({ where: { id: scanId }, data: { status: "created", courrierId: courrier.id, processedAt: new Date() } });
      return { status: "created", recordId: sinistre.id, redirectPath: `/courriers/sinistres/${sinistre.id}` };
    }

    // Permis de conduire / carte d'identité (2026-09-02): these belong to a Conducteur record
    // (numPermis/numCarteIdentite fields, see prisma schema), not a standalone Courrier type of
    // their own — but picking WHICH conducteur a scanned ID document belongs to isn't part of
    // this review step yet. Filed as a generic Courrier (visible in "Tous les documents" with the
    // correct type badge) so nothing is lost; an admin manually reports the extracted fields onto
    // the right conducteur's fiche from there.
    case "permis_conduire":
    case "carte_identite": {
      const courrier = await prisma.courrier.create({
        data: {
          societe,
          type: opts.finalType,
          source: "IMPORT",
          data: { ...f },
          fileName: scan.fileName,
          fileMime: scan.fileMime,
          fileSize: scan.fileSize,
          fileData: scan.fileData,
          receivedAt: scan.receivedAt,
          visibleClient,
        },
      });
      await prisma.emailScan.update({ where: { id: scanId }, data: { status: "created", courrierId: courrier.id, processedAt: new Date() } });
      return { status: "created", recordId: courrier.id, redirectPath: `/courriers` };
    }

    // "retard_paiement" is an internal payment-reminder Beneficiaire is always CSPL/NETECO/
    // Optimove Consulting — it's created from the app's own billing, never detected from a
    // third-party scanned document, so there is no OCR extractor for it (kept as a manual "à
    // remplir" shell, same as before).
    case "retard_paiement": {
      const courrier = await prisma.courrier.create({
        data: {
          societe,
          type: "retard_paiement",
          source: "IMPORT",
          data: { debiteur: null, montantDu: null, montantPaye: 0, reference: null, dateEcheance: null, statutPaiement: "Non payé" },
          fileName: scan.fileName,
          fileMime: scan.fileMime,
          fileSize: scan.fileSize,
          fileData: scan.fileData,
          receivedAt: scan.receivedAt,
          visibleClient,
        },
      });
      await prisma.emailScan.update({ where: { id: scanId }, data: { status: "created", courrierId: courrier.id, processedAt: new Date() } });
      return { status: "created", recordId: courrier.id, redirectPath: `/courriers/retards-paiement/${courrier.id}` };
    }

    case "inconnu":
    default: {
      // Generic "à classer" bucket — still lands in "Tous les courriers", per spec §6/§7, never
      // silently discarded and never force-classified into a wrong category.
      const courrier = await prisma.courrier.create({
        data: {
          societe,
          type: "document",
          source: "IMPORT",
          data: { statutClassification: "À classer" },
          fileName: scan.fileName,
          fileMime: scan.fileMime,
          fileSize: scan.fileSize,
          fileData: scan.fileData,
          receivedAt: scan.receivedAt,
          visibleClient,
        },
      });
      await prisma.emailScan.update({ where: { id: scanId }, data: { status: "created", courrierId: courrier.id, processedAt: new Date() } });
      return { status: "created", recordId: courrier.id, redirectPath: `/courriers` };
    }
  }
}

function ocrTextSafe(text: string | null): string {
  return text ?? "";
}
