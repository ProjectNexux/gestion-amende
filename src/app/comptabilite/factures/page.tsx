import { requireSociete } from "@/lib/auth";
import { PlaceholderSection } from "@/components/PlaceholderSection";

export const dynamic = "force-dynamic";

export default async function FacturesPage() {
  await requireSociete();
  return <PlaceholderSection title="Factures" />;
}
