import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable, useMembership } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import { linkNabrahAgent, listNabrahAgents, nabrahStatus, syncNabrahCallbacks } from "@/lib/nabrah.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/voice")({
  head: () => ({ meta: [{ title: "الوكيل الصوتي | صوتي" }, { name: "description", content: "متابعة ربط وحالة الوكيل الصوتي لشركتك." }, { property: "og:title", content: "الوكيل الصوتي | صوتي" }, { property: "og:description", content: "متابعة ربط وحالة الوكيل الصوتي لشركتك." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: VoicePage,
});

function VoicePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const { data: membership } = useMembership();
  const { data: agents } = useCompanyTable<{
    id: string;
    name: string;
    channel: string;
    is_active: boolean;
    provider: string | null;
    provider_agent_id: string | null;
  }>("ai_agents", companyId);
  const { data: numbers } = useCompanyTable<{ id: string; phone_number: string; sip_status: string }>(
    "phone_numbers",
    companyId,
  );

  const company = membership?.companies as { id: string; voice_enabled: boolean } | null;
  const voiceAgents = (agents ?? []).filter((a) => a.channel === "voice");

  async function toggleService(enabled: boolean) {
    if (!company) return;
    const { error } = await supabase.from("companies").update({ voice_enabled: enabled }).eq("id", company.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["membership"] });
  }

  const status = useServerFn(nabrahStatus);
  const link = useServerFn(linkNabrahAgent);
  const listAgentsFn = useServerFn(listNabrahAgents);
  const syncCallbacks = useServerFn(syncNabrahCallbacks);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ directLink: string; nabrahAgentId: string } | null>(null);

  const { data: nabrah } = useQuery({
    queryKey: ["nabrah-status", companyId],
    enabled: !!companyId,
    queryFn: () => status({ data: { companyId: companyId! } }),
  });
  const isAdmin = ["owner", "admin"].includes(String(membership?.role ?? ""));
  const { data: remoteAgents } = useQuery({
    queryKey: ["nabrah-agents", companyId],
    enabled: !!companyId && isAdmin,
    queryFn: () => listAgentsFn({ data: { companyId: companyId! } }),
  });
  const current = form ?? {
    directLink: nabrah?.directLink ?? "",
    nabrahAgentId: nabrah?.nabrahAgentId ?? "",
  };

  async function connectWebhook() {
    if (!companyId) return;
    setBusy(true);
    try {
      const res = await syncCallbacks({ data: { companyId } });
      if (res.ok) toast.success("تم توصيل الوكيل بالمنصة تلقائيًا");
      else toast.error(res.reason === "no_linked_agent" ? "اختر وكيل نبرة واحفظه أولًا" : String(res.reason));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }


  async function saveLink() {
    if (!companyId || !nabrah?.agentId) return;
    setBusy(true);
    try {
      await link({
        data: {
          companyId,
          agentId: nabrah.agentId,
          directLink: current.directLink.trim() || null,
          nabrahAgentId: current.nabrahAgentId.trim() || null,
        },
      });
      toast.success(t("saved"));
      setForm(null);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error && err.message.includes("https") ? "الرابط يجب أن يبدأ بـ https://" : String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("navVoice")}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t("voiceService")}</span>
          <Switch checked={!!company?.voice_enabled} onCheckedChange={toggleService} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("integrations")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>Nabrah (نبرة)</span>
            <Badge variant={nabrah?.status === "connected" ? "default" : "secondary"}>
              {nabrah?.status === "connected"
                ? t("connected")
                : nabrah?.status === "pending"
                  ? t("pending")
                  : t("notConnected")}
            </Badge>
          </div>
          {!nabrah?.agentId ? (
            <p className="text-sm text-muted-foreground">أضف وكيلًا صوتيًا أولًا من صفحة الوكلاء.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                أنشئ الوكيل في لوحة نبرة، ثم فعّل «الرابط المباشر» في أداة الاتصال والصقه هنا.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>الرابط المباشر من نبرة</Label>
                  <Input dir="ltr" placeholder="https://..." value={current.directLink}
                    onChange={(e) => setForm({ ...current, directLink: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>معرّف الوكيل في نبرة (اختياري)</Label>
                  <Input dir="ltr" value={current.nabrahAgentId}
                    onChange={(e) => setForm({ ...current, nabrahAgentId: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={saveLink} disabled={busy}>{t("save")}</Button>
                {nabrah.directLink ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={nabrah.directLink} target="_blank" rel="noopener noreferrer">جرّب الاتصال بالوكيل</a>
                  </Button>
                ) : null}
              </div>
              {nabrah.webhookUrl ? (
                <div className="space-y-2">
                  <Label>رابط الويب هوك (ضعه في إعدادات الوكيل عند نبرة ← Webhooks)</Label>
                  <div className="flex gap-2">
                    <Input dir="ltr" readOnly value={nabrah.webhookUrl} className="text-xs" />
                    <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(nabrah.webhookUrl!); toast.success("تم النسخ"); }}>
                      نسخ
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>


      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("navAgents")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {voiceAgents.length === 0 ? (
              <p className="text-muted-foreground">{t("empty")}</p>
            ) : (
              voiceAgents.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <span>{a.name}</span>
                  <Badge variant={a.is_active ? "default" : "secondary"}>
                    {a.is_active ? t("active") : t("inactive")}
                  </Badge>
                </div>
              ))
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/agents">{t("navAgents")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("navNumbers")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(numbers ?? []).length === 0 ? (
              <p className="text-muted-foreground">{t("empty")}</p>
            ) : (
              numbers!.map((n) => (
                <div key={n.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <span dir="ltr">{n.phone_number}</span>
                  <Badge variant={n.sip_status === "connected" ? "default" : "secondary"}>
                    {t(n.sip_status === "connected" ? "connected" : "notConnected")}
                  </Badge>
                </div>
              ))
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/numbers">{t("navNumbers")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
