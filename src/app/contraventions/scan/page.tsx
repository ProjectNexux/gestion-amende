import { requireSociete } from "@/lib/auth";
import ScanDocumentClient from "./ScanDocumentClient";
import { ScanEmailInfo, EmailScanList } from "@/components/EmailScanSection";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  await requireSociete();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Scanner un document</h1>
        <p className="text-sm text-slate-500">
          Importez n&apos;importe quel document (contravention, mise en demeure, URSSAF, certificat d&apos;immatriculation,
          facture, impôt, sinistre, permis de conduire, carte d&apos;identité…) : l&apos;OCR détecte automatiquement le type
          et extrait les informations.
        </p>
      </header>
      <ScanDocumentClient />
      <ScanEmailInfo />
      <EmailScanList />
    </div>
  );
}
