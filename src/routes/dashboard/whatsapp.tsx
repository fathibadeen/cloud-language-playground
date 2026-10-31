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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={account.status === "connected" ? "default" : "secondary"}>
                  {account.status === "connected" ? "متصل" : "قيد التفعيل"}
                </Badge>
                <span dir="ltr" className="text-sm font-medium">{account.phone_number}</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={busy || !canManage} className="text-destructive">
                    <Unlink className="size-4" />
                    فصل الرقم
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>فصل رقم واتساب؟</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتوقف الرد الآلي والتذكيرات على الرقم <span dir="ltr">{account.phone_number}</span> فوراً. تبقى المحادثات السابقة محفوظة، ويمكنك ربط الرقم مجدداً في أي وقت.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={disconnectNumber} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      نعم، افصل الرقم
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="space-y-2 md:w-72">
              <Label>{t("assignedAgent")}</Label>
              <Select value={account.agent_id ?? "none"} onValueChange={assignAgent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {waAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4 text-primary" />
              اربط رقم واتساب نشاطك
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              أدخل بيانات حساب واتساب للأعمال الخاص بك، وخلال ثوانٍ يبدأ وكيلك الذكي بالرد على عملائك وإرسال التذكيرات تلقائياً.
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="mb-2 text-sm font-semibold">أين أجد المعرفات؟</p>
                <ol className="space-y-1.5 text-sm text-muted-foreground">
                  <li>1. افتح developers.facebook.com واختر تطبيقك</li>
                  <li>2. من القائمة: WhatsApp ← API Setup</li>
                  <li>3. انسخ «Phone number ID» و«WhatsApp Business Account ID»</li>
                  <li>4. اكتب رقم الجوال بالصيغة الدولية مثل ‎+9665XXXXXXXX</li>
                </ol>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="mb-2 text-sm font-semibold">كيف أحصل على رمز الوصول الدائم؟</p>
                <ol className="space-y-1.5 text-sm text-muted-foreground">
                  <li>1. business.facebook.com ← الإعدادات ← مستخدمو النظام</li>
                  <li>2. أنشئ مستخدماً بدور «مسؤول» وعيّن له التطبيق وحساب واتساب</li>
                  <li>3. اضغط «إنشاء رمز» واختر المدة «أبداً»</li>
                  <li>4. فعّل صلاحيتي whatsapp_business_messaging و whatsapp_business_management</li>
                </ol>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>رقم الجوال</Label><Input dir="ltr" placeholder="+9665XXXXXXXX" value={direct.phoneNumber} onChange={(e) => setDirect({ ...direct, phoneNumber: e.target.value })} /></div>
              <div className="space-y-1"><Label>معرّف رقم الهاتف (Phone number ID)</Label><Input dir="ltr" value={direct.phoneNumberId} onChange={(e) => setDirect({ ...direct, phoneNumberId: e.target.value.trim() })} /></div>
              <div className="space-y-1"><Label>معرّف حساب واتساب للأعمال (WABA ID)</Label><Input dir="ltr" value={direct.wabaId} onChange={(e) => setDirect({ ...direct, wabaId: e.target.value.trim() })} /></div>
              <div className="space-y-1"><Label>رمز الوصول الدائم (Access token)</Label><Input dir="ltr" type="password" autoComplete="off" value={direct.accessToken} onChange={(e) => setDirect({ ...direct, accessToken: e.target.value.trim() })} /></div>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="mb-2 text-sm font-semibold">قبل الضغط على «ربط الرقم»:</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• الرمز المؤقت من صفحة API Setup ينتهي خلال 24 ساعة، استخدم الرمز الدائم.</li>
                <li>• الرقم المربوط لا يعمل على تطبيق واتساب العادي في الجوال.</li>
                <li>• الرسائل التي يبدأها نشاطك بعد 24 ساعة من آخر رسالة للعميل تحتاج قوالب معتمدة من واتساب.</li>
                <li>• الرمز يُحفظ مشفراً ولا يظهر لأحد بعد الحفظ.</li>
              </ul>
            </div>

            <Button size="lg" onClick={connectDirect} disabled={busy || !canManage || !direct.phoneNumber || !direct.phoneNumberId || !direct.wabaId || !direct.accessToken}>
              <CheckCircle2 className="size-4" />
              {busy ? "جارٍ التحقق…" : "تحقق واربط الرقم"}
            </Button>
            {!canManage ? <p className="text-xs text-muted-foreground">الربط متاح لمالك الحساب أو المدير فقط.</p> : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="size-4 text-primary" />
            سجل تذكيرات المواعيد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">يُرسل تذكير تلقائي لكل عميل قبل موعده بيوم عبر واتساب، ويطلب منه التأكيد أو إعادة الجدولة.</p>
          {(reminders ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">لا توجد تذكيرات مرسلة بعد.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {(reminders ?? []).map((r) => {
                const m = r.metadata ?? {};
                const st = r.action.replace("whatsapp.reminder_", "");
                return (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <div>
                      <p className="font-medium">{m.customer_name ?? "عميل"} <span dir="ltr" className="text-muted-foreground">{m.customer_phone}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {KIND_LABEL[m.kind ?? ""] ?? "تذكير"}
                        {m.start_time ? ` • الموعد: ${fmt(m.start_time)}` : ""}
                        {m.error ? ` • ${m.error}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={st === "sent" ? "default" : st === "failed" ? "destructive" : "secondary"}>
                        {st === "sent" ? "أُرسل" : st === "failed" ? "فشل" : "لم يُرسل"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { "24h": "تذكير قبل يوم", "2h": "تذكير قبل ساعتين", followup: "متابعة بعد الزيارة", noshow: "استرداد موعد فائت" };
function fmt(d: string) {
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(d));
}
