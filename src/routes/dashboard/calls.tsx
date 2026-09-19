import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/StatCard";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable } from "@/lib/tenant";

export const Route = createFileRoute("/dashboard/calls")({
  component: CallsPage,
});

type Call = {
  id: string;
  from_number: string | null;
  to_number: string | null;
  status: string;
  duration_seconds: number;
  transferred: boolean;
  created_at: string;
};

function CallsPage() {
  const { t } = useI18n();
  const companyId = useCompanyId();
  const { data: calls, isLoading } = useCompanyTable<Call>("voice_calls", companyId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("navCalls")}</h1>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (calls ?? []).length === 0 ? (
        <EmptyState text={t("empty")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("duration")}</TableHead>
                  <TableHead>{t("humanTransfers")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls!.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell dir="ltr">{c.from_number ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "completed" ? "default" : "secondary"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>{Math.round(c.duration_seconds / 60)}m</TableCell>
                    <TableCell>{c.transferred ? "✓" : "—"}</TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
