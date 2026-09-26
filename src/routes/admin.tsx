import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Building2,
  Coins,
  CreditCard,
  Link2,
  MessageCircle,
  Phone,
  Search,
  Settings2,
  ShieldCheck,
  Timer,
  Unplug,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { AdminShell, type AdminSection } from "@/components/AdminShell";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useIsSuperAdmin } from "@/lib/tenant";
import { getPlatformOverview, reviewConnectionRequest, setCompanyStatus, updateCompanySubscription } from "@/lib/admin.functions";
import {
  assignWhatsappAgent,
  completeWhatsappConnect,
  disconnectWhatsapp,
  getMetaConfig,
  testWhatsappConnection,
} from "@/lib/meta.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إدارة المنصة | صوتي" },
      { name: "description", content: "إدارة شركات واشتراكات منصة صوتي." },
      { property: "og:title", content: "إدارة المنصة | صوتي" },
      { property: "og:description", content: "إدارة شركات واشتراكات منصة صوتي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { section?: AdminSection } => {
    const v = search["section"];
    return ["overview", "companies", "whatsapp", "requests", "events"].includes(String(v)) ? { section: v as AdminSection } : {};
  },
  component: AdminPage,
});

type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

// ---- Meta Embedded Signup (client side of the flow) ----

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (callback: (response: { authResponse?: { code?: string } | null }) => void, options: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let fbSdkPromise: Promise<NonNullable<Window["FB"]>> | null = null;

function loadFbSdk(appId: string, version: string): Promise<NonNullable<Window["FB"]>> {
  if (window.FB) return Promise.resolve(window.FB);
  if (fbSdkPromise) return fbSdkPromise;
  fbSdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, cookie: false, xfbml: false, version });
      resolve(window.FB!);
    };
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.onerror = () => reject(new Error("fb_sdk_failed"));
      document.body.appendChild(script);
    }
  });
  return fbSdkPromise;
}

function metaErrorText(message: string, ar: boolean): string {
  const map: Record<string, string> = {
    meta_not_configured: ar ? "Meta غير مُهيأ بعد — أضف مفاتيح Meta أولاً من الإعدادات" : "Meta is not configured yet — add the Meta keys first",
    meta_auth_failed: ar ? "فشل التفويض مع Meta — تأكد أن المستخدم مدير حساب Business وجرّب من جديد" : "Meta authorization failed — try again",
    meta_business_verification: ar ? "حساب Meta Business يحتاج توثيق قبل الربط" : "Meta Business verification required",
    meta_no_waba: ar ? "لم يُعثر على حساب WhatsApp Business — أنشئ واحداً أثناء خطوات الربط" : "No WhatsApp Business account found",
    meta_no_phone_numbers: ar ? "لا يوجد رقم هاتف في حساب WhatsApp Business" : "No phone number in the WhatsApp Business account",
    meta_number_in_use: ar ? "هذا الرقم مرتبط بشركة أخرى في المنصة" : "This phone number is linked to another company",
    meta_api_error: ar ? "خطأ من Meta — حاول بعد قليل" : "Meta API error — try again later",
    meta_webhook_error: ar ? "تعذر تسجيل الويب هوك تلقائياً — تحقق من WHATSAPP_VERIFY_TOKEN" : "Could not register the webhook automatically",
    whatsapp_not_connected: ar ? "واتساب غير متصل لهذه الشركة" : "WhatsApp is not connected for this company",
    token_missing: ar ? "توكن الاتصال مفقود — أعد ربط واتساب" : "Connection token missing — reconnect",
    agent_not_in_company: ar ? "الوكيل المختار لا ينتمي لهذه الشركة" : "Selected agent does not belong to this company",
    company_not_found: ar ? "الشركة غير موجودة" : "Company not found",
    Forbidden: ar ? "هذه الصلاحية للمدير فقط" : "Admins only",
  };
  return map[message] ?? (ar ? `خطأ: ${message}` : `Error: ${message}`);
}

function AdminPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsSuperAdmin();
  const [search, setSearch] = useState("");
  const [savingCompany, setSavingCompany] = useState<string | null>(null);
  const ar = locale === "ar";
  const { section = "overview" } = Route.useSearch();
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["platform-overview"],
    enabled: !!isAdmin,
    queryFn: () => getPlatformOverview(),
  });

  const { data: metaConfig } = useQuery({
    queryKey: ["meta-config"],
    enabled: !!isAdmin,
    queryFn: () => getMetaConfig(),
  });

  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (data?.companies ?? []).filter((company) =>
      (!term || [company.name, company.city, company.industry].some((value) => value?.toLocaleLowerCase().includes(term))) &&
      (statusFilter === "all" || company.status === statusFilter) &&
      (productFilter === "all" || companyProduct(company) === productFilter),
    );
  }, [data?.companies, search, statusFilter, productFilter]);

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
  const statusText: Record<string, string> = ar
    ? { trialing: "تجريبي", active: "نشط", past_due: "متأخر", canceled: "ملغي" }
    : { trialing: "Trial", active: "Active", past_due: "Past due", canceled: "Canceled" };

  return (
    <AdminShell active={section}>
        {section === "overview" ? (<>
        <div><h1 className="font-display text-2xl font-bold md:text-3xl">{ar ? "نظرة شاملة على أعمالك" : "Your platform at a glance"}</h1><p className="mt-1 text-sm text-muted-foreground">{ar ? "تابع العملاء والاشتراكات والتشغيل من مكان واحد." : "Manage customers, subscriptions, and operations from one place."}</p></div>
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
        </>) : null}


        <Tabs value={section === "overview" ? "companies" : section} className="space-y-4">
          <TabsContent value="companies">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">{ar ? `الشركات (${filteredCompanies.length})` : `Companies (${filteredCompanies.length})`}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full max-w-xs"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ar ? "ابحث باسم الشركة أو المدينة" : "Search company or city"} className="ps-9" /></div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{ar ? "كل الحالات" : "All statuses"}</SelectItem><SelectItem value="active">{ar ? "نشطة" : "Active"}</SelectItem><SelectItem value="suspended">{ar ? "موقوفة" : "Suspended"}</SelectItem></SelectContent></Select>
                  <Select value={productFilter} onValueChange={setProductFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{ar ? "كل المنتجات" : "All products"}</SelectItem>{(["whatsapp", "voice", "bundle"] as const).map((p) => <SelectItem key={p} value={p}>{ar ? productLabels[p].ar : productLabels[p].en}</SelectItem>)}</SelectContent></Select>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table><TableHeader><TableRow><TableHead>{t("companyName")}</TableHead><TableHead>{t("city")}</TableHead><TableHead>{ar ? "المنتج" : "Product"}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{ar ? "الخطة" : "Plan"}</TableHead><TableHead>{ar ? "حالة الاشتراك" : "Subscription"}</TableHead><TableHead>{ar ? "عملاء / مستندات / وكلاء" : "Customers / docs / agents"}</TableHead><TableHead>{ar ? "التسجيل" : "Joined"}</TableHead><TableHead>{t("actions")}</TableHead></TableRow></TableHeader>
                  <TableBody>{isLoading ? <TableRow><TableCell colSpan={9}>{t("loading")}</TableCell></TableRow> : filteredCompanies.length === 0 ? <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">{t("empty")}</TableCell></TableRow> : filteredCompanies.map((company) => {
                    const subscription = subscriptionFor(company.id);
                    const disabled = savingCompany === company.id;
                    const product = companyProduct(company);
                    const counts = data?.companyCounts?.[company.id];
                    return <TableRow key={company.id}>
                      <TableCell><Link to="/admin/companies/$companyId" params={{ companyId: company.id }} className="font-medium text-primary underline-offset-4 hover:underline">{company.name}</Link><div className="text-xs text-muted-foreground">{company.industry ?? "—"}</div></TableCell>
                      <TableCell>{company.city ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{ar ? productLabels[product].ar : productLabels[product].en}</Badge></TableCell>
                      <TableCell><Badge variant={company.status === "active" ? "default" : "secondary"}>{company.status === "active" ? t("active") : t("inactive")}</Badge></TableCell>
                      <TableCell><Select disabled={disabled} value={subscription?.plan_id ?? "none"} onValueChange={(value) => updateSubscription(company.id, value === "none" ? null : value, (subscription?.status as SubscriptionStatus | undefined) ?? "trialing")}><SelectTrigger className="min-w-36"><SelectValue placeholder={ar ? "باقة قديمة" : "Legacy plan"} /></SelectTrigger><SelectContent><SelectItem value="none">{ar ? "بدون خطة" : "No plan"}</SelectItem>{(data?.plans ?? []).map((plan) => <SelectItem key={plan.id} value={plan.id}>{ar ? plan.name_ar : plan.name_en}</SelectItem>)}</SelectContent></Select></TableCell>
                      <TableCell><Select disabled={disabled} value={subscription?.status ?? "trialing"} onValueChange={(value) => updateSubscription(company.id, subscription?.plan_id ?? null, value as SubscriptionStatus)}><SelectTrigger className="min-w-32"><SelectValue /></SelectTrigger><SelectContent>{(["trialing", "active", "past_due", "canceled"] as const).map((status) => <SelectItem key={status} value={status}>{statusText[status]}</SelectItem>)}</SelectContent></Select></TableCell>
                      <TableCell className="tabular-nums">{counts?.customers ?? 0} / {counts?.documents ?? 0} / {counts?.agents ?? 0}</TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(company.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="whitespace-nowrap"><Button asChild size="sm"><Link to="/admin/companies/$companyId" params={{ companyId: company.id }}>{ar ? "عرض وتعديل" : "View & edit"}</Link></Button><Button disabled={disabled} variant="ghost" size="sm" onClick={() => toggleStatus(company.id, company.status)}>{company.status === "active" ? t("suspend") : t("activate")}</Button></TableCell>
                    </TableRow>;
                  })}</TableBody></Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="whatsapp">
            <WhatsappTab data={data} metaConfigured={!!metaConfig?.configured} metaAppId={metaConfig?.appId ?? null} metaConfigId={metaConfig?.configId ?? null} graphVersion={metaConfig?.graphVersion ?? "v21.0"} refetch={refetch} ar={ar} />
          </TabsContent>
          <TabsContent value="requests">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("connectRequests")}</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>{t("companyName")}</TableHead><TableHead>{t("provider")}</TableHead><TableHead>{t("phoneNumber")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("actions")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(data?.connectionRequests ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">{t("noRequests")}</TableCell></TableRow>
                    ) : (
                      data?.connectionRequests.map((request) => {
                        const payload = (request.payload ?? {}) as { phone_number?: string; business_name?: string };
                        const companyName = data?.companies.find((company) => company.id === request.company_id)?.name ?? "—";
                        return (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">{companyName}</TableCell>
                            <TableCell>{request.channel}</TableCell>
                            <TableCell dir="ltr">{payload.phone_number ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant={request.status === "approved" ? "default" : request.status === "rejected" ? "destructive" : "secondary"}>
                                {t(request.status === "approved" ? "requestApproved" : request.status === "rejected" ? "requestRejected" : "requestPending")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {request.status === "pending" ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        await reviewConnectionRequest({ data: { requestId: request.id, action: "approved" } });
                                        toast.success(t("saved"));
                                        await refetch();
                                      } catch (error) {
                                        toast.error(error instanceof Error ? error.message : String(error));
                                      }
                                    }}
                                  >
                                    {t("approve")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        await reviewConnectionRequest({ data: { requestId: request.id, action: "rejected" } });
                                        toast.success(t("saved"));
                                        await refetch();
                                      } catch (error) {
                                        toast.error(error instanceof Error ? error.message : String(error));
                                      }
                                    }}
                                  >
                                    {t("reject")}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">{request.admin_note ?? "—"}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="events"><Card><CardHeader><CardTitle className="text-base">{t("navWebhooks")}</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>{t("provider")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("date")}</TableHead></TableRow></TableHeader><TableBody>{(data?.webhooks ?? []).length === 0 ? <TableRow><TableCell colSpan={3} className="py-12 text-center text-muted-foreground">{t("empty")}</TableCell></TableRow> : data?.webhooks.map((event) => <TableRow key={event.id}><TableCell className="font-medium">{event.provider}</TableCell><TableCell><Badge variant={event.status === "failed" ? "destructive" : "secondary"}>{event.status}</Badge></TableCell><TableCell>{new Date(event.created_at).toLocaleString(ar ? "ar-SA" : "en-US")}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent>
        </Tabs>
    </AdminShell>
  );
}

// ============= WhatsApp management tab =============

type Overview = Awaited<ReturnType<typeof getPlatformOverview>>;

function WhatsappTab({
  data,
  metaConfigured,
  metaAppId,
  metaConfigId,
  graphVersion,
  refetch,
  ar,
}: {
  data: Overview | undefined;
  metaConfigured: boolean;
  metaAppId: string | null;
  metaConfigId: string | null;
  graphVersion: string;
  refetch: () => Promise<unknown>;
  ar: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [detailCompany, setDetailCompany] = useState<string | null>(null);

  const accountFor = useCallback(
    (companyId: string) => (data?.whatsappAccounts ?? []).find((account) => account.company_id === companyId),
    [data?.whatsappAccounts],
  );
  const agentsFor = useCallback(
    (companyId: string) => (data?.agents ?? []).filter((agent) => agent.company_id === companyId),
    [data?.agents],
  );

  async function run(key: string, action: () => Promise<unknown>, successText: string) {
    setBusy(key);
    try {
      await action();
      toast.success(successText);
      await refetch();
    } catch (error) {
      toast.error(metaErrorText(error instanceof Error ? error.message : String(error), ar));
    } finally {
      setBusy(null);
    }
  }

  function startConnect(companyId: string, companyName: string) {
    if (!metaConfigured) {
      toast.error(metaErrorText("meta_not_configured", ar));
      return;
    }
    setBusy(companyId);
    loadFbSdk(metaAppId!, graphVersion)
      .then(
        (FB) =>
          new Promise<void>((resolve) => {
            FB.login(async (response) => {
              const code = response?.authResponse?.code;
              resolve();
              if (!code) {
                toast.error(ar ? "أُلغيت خطوات الربط مع Meta" : "Meta signup was canceled");
                setBusy(null);
                return;
              }
              await run(companyId, () => completeWhatsappConnect({ data: { companyId, code } }), ar ? `تم ربط واتساب ${companyName}` : `WhatsApp connected for ${companyName}`);
            }, {
              config_id: metaConfigId,
              response_type: "code",
              override_default_response_type: true,
              extras: { setup: {} },
            });
          }),
      )
      .catch(() => {
        toast.error(ar ? "تعذر تحميل Meta — تحقق من الاتصال" : "Could not load Meta SDK");
        setBusy(null);
      });
  }

  async function assignAgent(companyId: string, agentId: string | null) {
    await run(companyId, () => assignWhatsappAgent({ data: { companyId, agentId } }), ar ? "تم تحديث الوكيل" : "Agent updated");
  }

  const detail = detailCompany ? data?.companies.find((company) => company.id === detailCompany) : null;
  const detailAccount = detailCompany ? accountFor(detailCompany) : null;
  const detailAgent = detailAccount?.agent_id ? (data?.agents ?? []).find((agent) => agent.id === detailAccount.agent_id) : null;
  const detailKb = detailAgent?.knowledge_base_id ? (data?.knowledgeBases ?? []).find((kb) => kb.id === detailAgent.knowledge_base_id) : null;
  const detailWebhook = detailCompany
    ? (data?.webhooks ?? []).find((event) => event.company_id === detailCompany && event.provider === "whatsapp")
    : null;

  return (
    <div className="space-y-4">
      {!metaConfigured && (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 size-5 text-amber-500" />
            <div className="text-sm">
              <p className="font-medium">{ar ? "Meta WhatsApp غير مُهيأ بعد" : "Meta WhatsApp is not configured yet"}</p>
              <p className="mt-1 text-muted-foreground">
                {ar
                  ? "لتفعيل الربط أضف مفاتيح Meta (META_APP_ID و META_APP_SECRET و META_CONFIG_ID) من إعدادات المشروع. لن تظهر أي شركة كـ «متصل» قبل ربط حقيقي عبر Meta."
                  : "Add META_APP_ID, META_APP_SECRET and META_CONFIG_ID in project settings. No company shows as connected before a real Meta connection."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="size-4" />{ar ? "ربط واتساب العملاء" : "Customer WhatsApp connections"}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? "الشركة" : "Company"}</TableHead>
                <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                <TableHead>{ar ? "الرقم" : "Number"}</TableHead>
                <TableHead>{ar ? "حساب الأعمال" : "Business"}</TableHead>
                <TableHead>{ar ? "الوكيل الذكي" : "AI agent"}</TableHead>
                <TableHead>{ar ? "تاريخ الربط" : "Connected"}</TableHead>
                <TableHead>{ar ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.companies ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">{ar ? "لا توجد شركات بعد" : "No companies yet"}</TableCell></TableRow>
              ) : (
                (data?.companies ?? []).map((company) => {
                  const account = accountFor(company.id);
                  const connected = account?.status === "connected" && account.is_active;
                  const errored = account?.status === "error";
                  const busyNow = busy === company.id;
                  return (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        <Badge variant={connected ? "default" : errored ? "destructive" : "secondary"}>
                          {connected ? (ar ? "متصل ✓" : "Connected ✓") : errored ? (ar ? "يحتاج إجراء" : "Needs action") : ar ? "غير متصل" : "Not connected"}
                        </Badge>
                      </TableCell>
                      <TableCell dir="ltr">{account?.phone_number ?? "—"}</TableCell>
                      <TableCell>{account?.verified_name ?? (account?.business_account_id ? <span dir="ltr" className="text-xs">{account.business_account_id}</span> : "—")}</TableCell>
                      <TableCell>
                        <Select
                          disabled={!connected || busyNow}
                          value={account?.agent_id ?? "none"}
                          onValueChange={(value) => assignAgent(company.id, value === "none" ? null : value)}
                        >
                          <SelectTrigger className="min-w-40"><SelectValue placeholder={ar ? "اختر وكيلاً" : "Pick an agent"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{ar ? "بدون وكيل" : "No agent"}</SelectItem>
                            {agentsFor(company.id).map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {account?.created_at ? new Date(account.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant={connected ? "outline" : "default"} disabled={busyNow} onClick={() => startConnect(company.id, company.name)}>
                            <Link2 className="size-3.5" />{connected ? (ar ? "إعادة الربط" : "Reconnect") : ar ? "ربط WhatsApp" : "Connect"}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={!account || busyNow} onClick={() => setDetailCompany(company.id)}>
                            <Settings2 className="size-3.5" />{ar ? "إدارة" : "Manage"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!connected || busyNow}
                            onClick={() => run(`${company.id}-test`, () => testWhatsappConnection({ data: { companyId: company.id } }), ar ? "الاتصال سليم ✓" : "Connection OK ✓")}
                          >
                            <ShieldCheck className="size-3.5" />{ar ? "اختبار الاتصال" : "Test"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!connected || busyNow}
                            onClick={() => run(company.id, () => disconnectWhatsapp({ data: { companyId: company.id } }), ar ? "تم فصل واتساب — المحادثات محفوظة" : "WhatsApp disconnected — history kept")}
                          >
                            <Unplug className="size-3.5" />{ar ? "فصل" : "Disconnect"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detailCompany} onOpenChange={(open) => !open && setDetailCompany(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Phone className="size-4" />{detail?.name ?? ""}</DialogTitle>
          </DialogHeader>
              {detail && detailAccount ? (
            <div className="space-y-2 text-sm">
              <Row label={ar ? "حالة الاتصال" : "Status"} value={detailAccount.status === "connected" && detailAccount.is_active ? (ar ? "متصل ✓" : "Connected ✓") : ar ? "غير متصل" : "Not connected"} />
              <Row label={ar ? "حساب Meta Business" : "Meta Business account"} value={<span dir="ltr">{detailAccount.business_account_id ?? "—"}</span>} />
              <Row label={ar ? "معرّف رقم الهاتف" : "Phone number ID"} value={<span dir="ltr">{detailAccount.phone_number_id ?? "—"}</span>} />
              <Row label={ar ? "الرقم" : "Number"} value={<span dir="ltr">{detailAccount.phone_number ?? "—"}</span>} />
              <Row label={ar ? "الاسم الموثق" : "Verified name"} value={detailAccount.verified_name ?? "—"} />
              <Row label={ar ? "الوكيل الذكي" : "AI agent"} value={detailAgent?.name ?? (ar ? "بدون وكيل" : "No agent")} />
              <Row label={ar ? "قاعدة المعرفة" : "Knowledge base"} value={detailKb?.name ?? (ar ? "بدون" : "None")} />
              <Row label={ar ? "رسائل اليوم" : "Messages today"} value={String(data?.waStats?.messagesTodayByCompany?.[detail.id] ?? 0)} />
              <Row label={ar ? "محادثات اليوم" : "Conversations today"} value={String(data?.waStats?.conversationsTodayByCompany?.[detail.id] ?? 0)} />
              <Row label={ar ? "آخر حدث ويب هوك" : "Last webhook"} value={detailWebhook ? `${detailWebhook.status} · ${new Date(detailWebhook.created_at).toLocaleString(ar ? "ar-SA" : "en-US")}` : "—"} />
              <Row label={ar ? "أخطاء" : "Errors"} value={String((data?.webhooks ?? []).filter((event) => event.company_id === detail.id && event.status === "failed").length)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{ar ? "لم يتم ربط واتساب لهذه الشركة بعد." : "WhatsApp is not connected for this company yet."}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
