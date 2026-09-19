import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable, usePlans, useSubscription } from "@/lib/tenant";


export const Route = createFileRoute("/dashboard/billing")({
  component: BillingPage,
});

type Invoice = {
  id: string;
  amount_sar: number;
  status: string;
  issued_at: string;
  provider: string | null;
};

function BillingPage() {
  const { t, locale } = useI18n();
  const companyId = useCompanyId();
  const { data: subscription } = useSubscription(companyId);
  const { data: plans } = usePlans();
  const { data: invoices } = useCompanyTable<Invoice>("billing_records", companyId);

  const currentPlanId = subscription?.plan_id;


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("navBilling")}</h1>

      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">{t("paymentsSoon")}</CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {(plans ?? []).map((p) => {
          const current = p.id === currentPlanId;
          return (
            <Card key={p.id} className={current ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {locale === "ar" ? p.name_ar : p.name_en}
                  {current ? <Badge>{t("currentPlan")}</Badge> : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">
                  {Number(p.price_sar).toFixed(0)}
                  <span className="ms-2 text-sm font-normal text-muted-foreground">{t("perMonth")}</span>
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>
                    {p.voice_minutes} {t("voiceMinutes")}
                  </li>
                  <li>
                    {p.whatsapp_messages} {t("whatsappMessages")}
                  </li>
                  <li>
                    {p.max_agents} {t("navAgents")}
                  </li>
                </ul>
                <Button className="w-full" variant="outline" disabled>
                  {current ? t("currentPlan") : t("paymentsDisabled")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("invoices")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("provider")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoices ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                invoices!.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{new Date(inv.issued_at).toLocaleDateString()}</TableCell>
                    <TableCell>{Number(inv.amount_sar).toFixed(2)}</TableCell>
                    <TableCell>{inv.status}</TableCell>
                    <TableCell>{inv.provider ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
