import { requireSociete } from "@/lib/auth";
import { PlaceholderSection } from "@/components/PlaceholderSection";

export const dynamic = "force-dynamic";

export default async function SinistresPage() {
  await requireSociete();
  return <PlaceholderSection title="Sinistres" />;
}
