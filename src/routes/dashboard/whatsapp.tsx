import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, MessageSquare, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable, useMembership } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import { humanizeDbError } from "@/lib/errors";
import { AgentTester } from "@/components/AgentTester";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMetaConfig, completeWhatsappConnect, syncProviderWhatsapp, connectWhatsappDirect } from "@/lib/meta.functions";
import { runEmbeddedSignup } from "@/lib/meta-signup";


export const Route = createFileRoute("/dashboard/whatsapp")({
  head: () => ({ meta: [{ title: "واتساب الأعمال | صوتي" }, { name: "description", content: "متابعة ربط واتساب الأعمال والوكيل الذكي لشركتك." }, { property: "og:title", content: "واتساب الأعمال | صوتي" }, { property: "og:description", content: "متابعة ربط واتساب الأعمال والوكيل الذكي لشركتك." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: WhatsappPage,
});

type Account = {
  id: string;
  provider: string;
  phone_number: string | null;
  status: string;
  agent_id: string | null;
};

type ConnectRequest = {
  id: string;
  channel: string;
  status: "pending" | "approved" | "rejected";
  payload: { phone_number?: string; business_name?: string };
  admin_note: string | null;
  created_at: string;
};

function WhatsappPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const { data: membership } = useMembership();
  const { data: accounts } = useCompanyTable<Account>("whatsapp_accounts", companyId);
  const { data: agents } = useCompanyTable<{ id: string; name: string; channel: string }>(
    "ai_agents",
    companyId,
  );
  const { data: requests } = useCompanyTable<ConnectRequest>("connection_requests", companyId);
  const [form, setForm] = useState({ phone_number: "", business_name: "" });
  const [busy, setBusy] = useState(false);
  const fetchMeta = useServerFn(getMetaConfig);
  const finishConnect = useServerFn(completeWhatsappConnect);
  const syncWa = useServerFn(syncProviderWhatsapp);
  const directWa = useServerFn(connectWhatsappDirect);
  const [direct, setDirect] = useState({ phoneNumber: "", phoneNumberId: "", wabaId: "", accessToken: "" });

  async function connectDirect() {
    if (!companyId) return;
    setBusy(true);
    try {
      const r = await directWa({ data: { companyId, ...direct, phoneNumber: direct.phoneNumber.replace(/[\s-]/g, "") } });
      toast.success(`تم ربط الرقم ${r.phone} بنجاح ✅`);
      setDirect({ phoneNumber: "", phoneNumberId: "", wabaId: "", accessToken: "" });
      qc.invalidateQueries({ queryKey: ["whatsapp_accounts"] });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      const map: Record<string, string> = {
        invalid_credentials: "البيانات غير صحيحة أو الرمز لا يملك صلاحية على هذا الرقم",
        number_taken: "هذا الرقم مرتبط بحساب آخر",
        provider_failed: "تحقّقنا من البيانات لكن تعذر تفعيل الرد الآلي، حاول لاحقاً أو تواصل مع الدعم",
        Forbidden: "الربط متاح لمالك الحساب أو المدير فقط",
      };
      toast.error(map[m] ?? "تأكد من صيغة الحقول (أرقام فقط) وحاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }

  async function syncNumber() {
    if (!companyId) return;
    setBusy(true);
    try {
      const r = await syncWa({ data: { companyId } });
      if (r.linked.length) {
        toast.success(`تم ربط الرقم: ${r.linked.join("، ")}`);
        qc.invalidateQueries({ queryKey: ["whatsapp_accounts"] });
      } else if (r.taken) toast.error("الرقم المتاح مرتبط بحساب آخر، تواصل مع الدعم");
      else toast.error("لم نجد رقماً جاهزاً بعد. أكمل الربط مع فريقنا ثم أعد المحاولة");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg === "Forbidden" ? "الربط متاح لمالك الحساب أو المدير فقط" : "تعذر التحقق من الرقم حالياً");
    } finally {
      setBusy(false);
    }
  }
  const { data: metaCfg } = useQuery({ queryKey: ["meta-config"], queryFn: () => fetchMeta() });
  const canManage = ["owner", "admin"].includes(String((membership as { role?: string } | null)?.role ?? ""));

  async function connectMeta() {
    if (!companyId || !metaCfg?.appId || !metaCfg.configId) {
      toast.error("ربط Meta غير متاح حالياً، تواصل مع الدعم");
      return;
    }
    setBusy(true);
    try {
      const r = await runEmbeddedSignup(metaCfg.appId, metaCfg.configId, metaCfg.graphVersion);
      if (!r.code) {
        toast.error("لم يكتمل الربط مع Meta، حاول مرة أخرى");
        return;
      }
      await finishConnect({
        data: {
          companyId,
          code: r.code,
          redirectUri: r.redirectUri,
          pageUrls: [window.location.href.split("#")[0], `${window.location.origin}/admin`, `${window.location.origin}/`],
          wabaId: r.wabaId,
          phoneNumberId: r.phoneNumberId,
        },
      });
      toast.success("تم ربط رقم واتساب بنجاح");
      qc.invalidateQueries({ queryKey: ["whatsapp_accounts"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg === "Forbidden" ? "الربط متاح لمالك الحساب أو المدير فقط" : `تعذر الربط: ${msg.split("|").pop()}`);
    } finally {
      setBusy(false);
    }
  }

  const company = membership?.companies as { id: string; name: string; whatsapp_enabled: boolean } | null;
  const account = accounts?.[0];
  const waAgents = (agents ?? []).filter((a) => a.channel === "whatsapp");

  const latestRequest = (requests ?? [])
    .filter((r) => r.channel === "whatsapp")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  async function requestConnect() {
    if (!companyId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("connection_requests").insert({
        company_id: companyId,
        channel: "whatsapp",
        payload: {
          phone_number: form.phone_number,
          business_name: form.business_name || company?.name || "",
        },
      });
      if (error) {
        toast.error(humanizeDbError(error.message, t));
        return;
      }
      toast.success(t("requestSent"));
      setForm({ phone_number: "", business_name: "" });
      qc.invalidateQueries({ queryKey: ["connection_requests"] });
    } finally {
      setBusy(false);
    }
  }

  async function toggleService(enabled: boolean) {
    if (!company) return;
    const { error } = await supabase
      .from("companies")
      .update({ whatsapp_enabled: enabled })
      .eq("id", company.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["membership"] });
  }

  async function assignAgent(agentId: string) {
    if (!account) return;
    await supabase
      .from("whatsapp_accounts")
      .update({ agent_id: agentId === "none" ? null : agentId })
      .eq("id", account.id);
    qc.invalidateQueries({ queryKey: ["whatsapp_accounts"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("navWhatsapp")}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t("whatsappService")}</span>
          <Switch checked={!!company?.whatsapp_enabled} onCheckedChange={toggleService} />
        </div>
      </div>

      {waAgents.length > 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-semibold">جرّب وكيل واتساب قبل إطلاقه</p>
              <p className="text-sm text-muted-foreground">
                محادثة تجريبية بنفس ردود الوكيل وقاعدة معرفة شركتك، بلا رسائل حقيقية.
              </p>
            </div>
            <AgentTester
              companyId={companyId}
              agentId={waAgents[0]!.id}
              agentName={waAgents[0]!.name}
              label="تجربة المحادثة"
            />
          </CardContent>
        </Card>
      ) : null}



      {account ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={account.status === "connected" ? "default" : "secondary"}>
                {t(account.status === "connected" ? "requestApproved" : "requestPending")}
              </Badge>
              <span dir="ltr" className="text-sm font-medium">
                {account.phone_number}
              </span>
            </div>
            <div className="space-y-2 md:w-72">
              <Label>{t("assignedAgent")}</Label>
              <Select value={account.agent_id ?? "none"} onValueChange={assignAgent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {(agents ?? [])
                    .filter((a) => a.channel === "whatsapp")
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ) : latestRequest?.status === "pending" ? (
        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <Clock className="mt-1 size-6 text-primary" />
            <div className="space-y-1">
              <p className="font-semibold">{t("requestPending")}</p>
              <p className="text-sm text-muted-foreground" dir="ltr">
                {latestRequest.payload.phone_number}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4 text-primary" />
              {t("whatsappConnectTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-5 rounded-xl border border-primary/30 bg-primary/5 p-5">
              <div className="space-y-1">
                <p className="text-lg font-bold">اربط رقم واتساب نشاطك</p>
                <p className="text-sm text-muted-foreground">
                  خلال دقائق يبدأ وكيلك الذكي بالرد على عملائك على مدار الساعة، ويرسل التذكيرات وتأكيد المواعيد تلقائياً.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-background p-4">
                  <p className="mb-2 text-sm font-semibold">قبل أن تبدأ، جهّز:</p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li>• رقم جوال للنشاط يستقبل رسالة أو مكالمة رمز التحقق</li>
                    <li>• حساب فيسبوك لصاحب النشاط أو المسؤول عنه</li>
                    <li>• اسم النشاط كما تريد أن يظهر للعملاء</li>
                    <li>• (اختياري) السجل التجاري لتوثيق الحساب ورفع حدود الإرسال</li>
                  </ul>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="mb-2 text-sm font-semibold">خطوات الربط:</p>
                  <ol className="space-y-1.5 text-sm text-muted-foreground">
                    <li>1. اضغط زر «ربط واتساب» بالأسفل</li>
                    <li>2. سجّل الدخول بحساب فيسبوك</li>
                    <li>3. أنشئ أو اختر حساب واتساب للأعمال</li>
                    <li>4. أدخل رقم الجوال وأكّد برمز التحقق</li>
                    <li>5. ارجع هنا — يظهر الرقم «متصل» تلقائياً</li>
                  </ol>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="mb-2 text-sm font-semibold">ما يترتب على الربط — اقرأ بعناية:</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>• الرقم المربوط ينتقل لواتساب الأعمال الرسمي، ولن يعمل بعدها على تطبيق واتساب العادي في الجوال. إن كان مستخدماً حالياً، احذف حسابه من التطبيق أولاً أو استخدم رقماً جديداً.</li>
                  <li>• الرسائل التي يبدأها النشاط (مثل التذكيرات) بعد مرور 24 ساعة على آخر رسالة من العميل تتطلب قوالب معتمدة، وقد تُحتسب عليها رسوم من واتساب.</li>
                  <li>• يبدأ الحساب الجديد بحد يومي لعدد المحادثات، ويرتفع تلقائياً مع جودة التواصل وتوثيق النشاط.</li>
                  <li>• تجنّب الرسائل المزعجة أو المرسلة لمن لم يطلبها، حفاظاً على تقييم الرقم وتجنباً للإيقاف.</li>
                  <li>• يمكنك إيقاف الرد الآلي في أي وقت من المفتاح أعلى الصفحة.</li>
                </ul>
              </div>

              <Button size="lg" onClick={connectMeta} disabled={busy || !canManage} className="w-full sm:w-auto">
                <MessageSquare className="size-4" />
                {busy ? "جارٍ الربط…" : "ربط واتساب"}
              </Button>
              <Button size="lg" variant="outline" onClick={syncNumber} disabled={busy || !canManage} className="w-full sm:w-auto sm:ms-2">
                <CheckCircle2 className="size-4" />
                تحقق من رقمي المربوط
              </Button>
              <p className="text-xs text-muted-foreground">إذا ربط فريقنا رقمك مسبقاً، اضغط «تحقق من رقمي المربوط» ليظهر «متصل» فوراً.</p>
              {!canManage ? <p className="text-xs text-muted-foreground">الربط متاح لمالك الحساب أو المدير فقط.</p> : null}

              <details className="rounded-lg border p-4">
                <summary className="cursor-pointer text-sm font-semibold">ربط متقدم: لديّ حساب واتساب أعمال مفعّل وبياناته جاهزة</summary>
                <p className="mt-2 text-xs text-muted-foreground">
                  تجد هذه البيانات في developers.facebook.com ← تطبيقك ← WhatsApp ← إعداد واجهة API. استخدم رمز وصول دائم من «مستخدم النظام» في إعدادات الأعمال (الرمز المؤقت ينتهي خلال 24 ساعة).
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label>رقم الجوال</Label><Input dir="ltr" placeholder="+9665XXXXXXXX" value={direct.phoneNumber} onChange={(e) => setDirect({ ...direct, phoneNumber: e.target.value })} /></div>
                  <div className="space-y-1"><Label>معرّف رقم الهاتف (Phone number ID)</Label><Input dir="ltr" value={direct.phoneNumberId} onChange={(e) => setDirect({ ...direct, phoneNumberId: e.target.value.trim() })} /></div>
                  <div className="space-y-1"><Label>معرّف حساب واتساب للأعمال (WABA ID)</Label><Input dir="ltr" value={direct.wabaId} onChange={(e) => setDirect({ ...direct, wabaId: e.target.value.trim() })} /></div>
                  <div className="space-y-1"><Label>رمز الوصول الدائم (Access token)</Label><Input dir="ltr" type="password" autoComplete="off" value={direct.accessToken} onChange={(e) => setDirect({ ...direct, accessToken: e.target.value.trim() })} /></div>
                </div>
                <Button className="mt-3" onClick={connectDirect} disabled={busy || !canManage || !direct.phoneNumber || !direct.phoneNumberId || !direct.wabaId || !direct.accessToken}>
                  <CheckCircle2 className="size-4" />
                  {busy ? "جارٍ التحقق…" : "تحقق واربط الرقم"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">نتحقق من البيانات مع واتساب أولاً، ثم نفعّل الرد الآلي فوراً. الرمز يُحفظ مشفراً.</p>
              </details>
            </div>
            <p className="text-sm text-muted-foreground">أو أرسل طلب ربط لفريقنا:</p>
            <p className="text-sm text-muted-foreground">{t("whatsappConnectDesc")}</p>
            {latestRequest?.status === "rejected" ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <XCircle className="mt-0.5 size-4 text-destructive" />
                <div>
                  <p className="font-medium">{t("requestRejected")}</p>
                  {latestRequest.admin_note ? (
                    <p className="text-muted-foreground">{latestRequest.admin_note}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("whatsappNumberLabel")}</Label>
                <Input
                  dir="ltr"
                  placeholder="+9665xxxxxxxx"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("businessName")}</Label>
                <Input
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={requestConnect} disabled={busy || !form.phone_number.trim()}>
              {t("requestWhatsappConnect")}
            </Button>
          </CardContent>
        </Card>
      )}

      {account?.status === "connected" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-primary" />
          {t("whatsappActive")}
        </div>
      ) : null}
    </div>
  );
}
