import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, CreditCard, Coins, Bot, Timer, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useIsSuperAdmin } from "@/lib/tenant";
import { getPlatformOverview, setCompanyStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminPage,
});

function AdminPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsSuperAdmin();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["platform-overview"],
    enabled: !!isAdmin,
    queryFn: () => getPlatformOverview(),
  });

  if (loading || adminLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">{t("loading")}</div>;
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center gap-4 text-center">
        <div>
          <p className="text-lg font-semibold">{t("noAccess")}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/dashboard">{t("backToDashboard")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  async function toggleStatus(companyId: string, status: string) {
    try {
      await setCompanyStatus({
        data: { companyId, status: status === "active" ? "suspended" : "active" },
      });
      toast.success(t("saved"));
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  const totals = data?.totals;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="flex h-16 items-center justify-between border-b bg-background px-4">
        <span className="font-semibold">{t("navAdmin")}</span>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">{t("backToDashboard")}</Link>
          </Button>
        </div>
      </header>

      <main className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label={t("totalCompanies")} value={totals?.companies ?? 0} icon={Building2} />
          <StatCard label={t("activeCompanies")} value={totals?.activeCompanies ?? 0} icon={Building2} />
          <StatCard label={t("subscriptionsCount")} value={totals?.subscriptions ?? 0} icon={CreditCard} />
          <StatCard label={t("revenue")} value={`${totals?.revenue ?? 0} SAR`} icon={Coins} />
          <StatCard label={t("activeAgents")} value={totals?.activeAgents ?? 0} icon={Bot} />
          <StatCard label={t("minutesUsed")} value={totals?.minutes ?? 0} icon={Timer} />
          <StatCard label={t("waToday")} value={totals?.whatsappConversations ?? 0} icon={Bot} />
          <StatCard label={t("webhookErrors")} value={totals?.webhookErrors ?? 0} icon={AlertTriangle} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("navCompanies")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("companyName")}</TableHead>
                  <TableHead>{t("city")}</TableHead>
                  <TableHead>{t("industry")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>{t("loading")}</TableCell>
                  </TableRow>
                ) : (
                  (data?.companies ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.city ?? "—"}</TableCell>
                      <TableCell>{c.industry ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "active" ? "default" : "secondary"}>
                          {c.status === "active" ? t("active") : t("inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => toggleStatus(c.id, c.status)}>
                          {c.status === "active" ? t("suspend") : t("activate")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("navWebhooks")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("provider")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.webhooks ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  data!.webhooks.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{w.provider}</TableCell>
                      <TableCell>{w.status}</TableCell>
                      <TableCell>{new Date(w.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
