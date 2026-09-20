import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Bot, Building2, Coins, CreditCard, Search, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useIsSuperAdmin } from "@/lib/tenant";
import { getPlatformOverview, setCompanyStatus, updateCompanySubscription } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إدارة المنصة | موظفك" },
      { name: "description", content: "إدارة شركات واشتراكات منصة موظفك." },
      { property: "og:title", content: "إدارة المنصة | موظفك" },
      { property: "og:description", content: "إدارة شركات واشتراكات منصة موظفك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

function AdminPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsSuperAdmin();
  const [search, setSearch] = useState("");
  const [savingCompany, setSavingCompany] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["platform-overview"],
    enabled: !!isAdmin,
    queryFn: () => getPlatformOverview(),
  });

  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return data?.companies ?? [];
    return (data?.companies ?? []).filter((company) =>
      [company.name, company.city, company.industry].some((value) => value?.toLocaleLowerCase().includes(term)),
    );
  }, [data?.companies, search]);

  if (loading || adminLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">{t("loading")}</div>;
  if (!isAdmin) return <div className="grid min-h-screen place-items-center text-center"><div><p className="text-lg font-semibold">{t("noAccess")}</p><Button asChild variant="outline" className="mt-4"><Link to="/dashboard">{t("backToDashboard")}</Link></Button></div></div>;

  async function toggleStatus(companyId: string, status: string) {
    setSavingCompany(companyId);
    try {
      await setCompanyStatus({ data: { companyId, status: status === "active" ? "suspended" : "active" } });
      toast.success(t("saved"));
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingCompany(null);
    }
  }

  async function updateSubscription(companyId: string, planId: string | null, status: SubscriptionStatus) {
    setSavingCompany(companyId);
    try {
      await updateCompanySubscription({ data: { companyId, planId, status } });
      toast.success(t("saved"));
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingCompany(null);
    }
  }

  const totals = data?.totals;
  const subscriptionFor = (companyId: string) => data?.subscriptions.find((subscription) => subscription.company_id === companyId);
  const statusText: Record<string, string> = locale === "ar"
    ? { trialing: "تجريبي", active: "نشط", past_due: "متأخر", canceled: "ملغي" }
    : { trialing: "Trial", active: "Active", past_due: "Past due", canceled: "Canceled" };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1600px] items-center justify-between px-4 md:px-7">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-sidebar font-display font-bold text-sidebar-primary">م</span><div><p className="font-display font-semibold">{t("navAdmin")}</p><p className="text-xs text-muted-foreground">{locale === "ar" ? "مركز قيادة المنصة" : "Platform command center"}</p></div></div>
          <div className="flex items-center gap-2"><LanguageToggle /><Button asChild variant="outline" size="sm"><Link to="/dashboard">{t("backToDashboard")}</Link></Button></div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-7 p-4 md:p-7">
        <div><h1 className="font-display text-2xl font-bold md:text-3xl">{locale === "ar" ? "نظرة شاملة على أعمالك" : "Your platform at a glance"}</h1><p className="mt-1 text-sm text-muted-foreground">{locale === "ar" ? "تابع العملاء والاشتراكات والتشغيل من مكان واحد." : "Manage customers, subscriptions, and operations from one place."}</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("totalCompanies")} value={totals?.companies ?? 0} icon={Building2} />
          <StatCard label={t("subscriptionsCount")} value={totals?.subscriptions ?? 0} icon={CreditCard} />
          <StatCard label={t("revenue")} value={`${totals?.revenue ?? 0} SAR`} icon={Coins} />
          <StatCard label={t("minutesUsed")} value={totals?.minutes ?? 0} icon={Timer} />
          <StatCard label={t("activeCompanies")} value={totals?.activeCompanies ?? 0} icon={Building2} />
          <StatCard label={t("activeAgents")} value={totals?.activeAgents ?? 0} icon={Bot} />
          <StatCard label={t("waToday")} value={totals?.whatsappConversations ?? 0} icon={Bot} />
          <StatCard label={t("webhookErrors")} value={totals?.webhookErrors ?? 0} icon={AlertTriangle} />
        </div>

        <Tabs defaultValue="companies" className="space-y-4">
          <TabsList><TabsTrigger value="companies">{locale === "ar" ? "العملاء والاشتراكات" : "Customers & subscriptions"}</TabsTrigger><TabsTrigger value="events">{t("navWebhooks")}</TabsTrigger></TabsList>
          <TabsContent value="companies">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4"><CardTitle className="text-base">{t("navCompanies")}</CardTitle><div className="relative w-full max-w-xs"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={locale === "ar" ? "ابحث باسم الشركة أو المدينة" : "Search company or city"} className="ps-9" /></div></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table><TableHeader><TableRow><TableHead>{t("companyName")}</TableHead><TableHead>{t("city")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{locale === "ar" ? "الخطة" : "Plan"}</TableHead><TableHead>{locale === "ar" ? "حالة الاشتراك" : "Subscription"}</TableHead><TableHead>{t("actions")}</TableHead></TableRow></TableHeader>
                  <TableBody>{isLoading ? <TableRow><TableCell colSpan={6}>{t("loading")}</TableCell></TableRow> : filteredCompanies.length === 0 ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">{t("empty")}</TableCell></TableRow> : filteredCompanies.map((company) => {
                    const subscription = subscriptionFor(company.id);
                    const disabled = savingCompany === company.id;
                    return <TableRow key={company.id}>
                      <TableCell><div className="font-medium">{company.name}</div><div className="text-xs text-muted-foreground">{company.industry ?? "—"}</div></TableCell>
                      <TableCell>{company.city ?? "—"}</TableCell>
                      <TableCell><Badge variant={company.status === "active" ? "default" : "secondary"}>{company.status === "active" ? t("active") : t("inactive")}</Badge></TableCell>
                      <TableCell><Select disabled={disabled} value={subscription?.plan_id ?? "none"} onValueChange={(value) => updateSubscription(company.id, value === "none" ? null : value, (subscription?.status as SubscriptionStatus | undefined) ?? "trialing")}><SelectTrigger className="min-w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{locale === "ar" ? "بدون خطة" : "No plan"}</SelectItem>{(data?.plans ?? []).map((plan) => <SelectItem key={plan.id} value={plan.id}>{locale === "ar" ? plan.name_ar : plan.name_en}</SelectItem>)}</SelectContent></Select></TableCell>
                      <TableCell><Select disabled={disabled} value={subscription?.status ?? "trialing"} onValueChange={(value) => updateSubscription(company.id, subscription?.plan_id ?? null, value as SubscriptionStatus)}><SelectTrigger className="min-w-32"><SelectValue /></SelectTrigger><SelectContent>{(["trialing", "active", "past_due", "canceled"] as const).map((status) => <SelectItem key={status} value={status}>{statusText[status]}</SelectItem>)}</SelectContent></Select></TableCell>
                      <TableCell><Button disabled={disabled} variant="ghost" size="sm" onClick={() => toggleStatus(company.id, company.status)}>{company.status === "active" ? t("suspend") : t("activate")}</Button></TableCell>
                    </TableRow>;
                  })}</TableBody></Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="events"><Card><CardHeader><CardTitle className="text-base">{t("navWebhooks")}</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>{t("provider")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("date")}</TableHead></TableRow></TableHeader><TableBody>{(data?.webhooks ?? []).length === 0 ? <TableRow><TableCell colSpan={3} className="py-12 text-center text-muted-foreground">{t("empty")}</TableCell></TableRow> : data?.webhooks.map((event) => <TableRow key={event.id}><TableCell className="font-medium">{event.provider}</TableCell><TableCell><Badge variant={event.status === "failed" ? "destructive" : "secondary"}>{event.status}</Badge></TableCell><TableCell>{new Date(event.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}