import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

// Simple placeholder for sections whose business logic is not built yet.
export function PlaceholderSection({
  title,
  description,
  message = "Cette fonctionnalité sera ajoutée prochainement.",
}: {
  title: string;
  description?: string;
  message?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent>
          <p className="text-sm text-slate-500">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
