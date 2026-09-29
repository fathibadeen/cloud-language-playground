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
import { nabrahStatus } from "@/lib/nabrah.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgentTester } from "@/components/AgentTester";
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
  const [preview, setPreview] = useState(false);

  const { data: nabrah } = useQuery({
    queryKey: ["nabrah-status", companyId],
    enabled: !!companyId,
    queryFn: () => status({ data: { companyId: companyId! } }),
  });


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
                {nabrah.status === "connected"
                  ? "وكيلك الصوتي جاهز، وسجل المكالمات يصل إلى لوحتك تلقائيًا."
                  : "وكيلك الصوتي قيد التجهيز من فريق صوتي. سنفعّله لحسابك ونبلغك فور جاهزيته."}
              </p>
              <div className="flex flex-wrap gap-2">
                {nabrah.agentId ? (
                  <AgentTester
                    companyId={companyId}
                    agentId={nabrah.agentId}
                    agentName={voiceAgents[0]?.name ?? "الوكيل الصوتي"}
                    label="تجربة كتابية"
                  />
                ) : null}
                {nabrah.directLink ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setPreview(true)}>
                      تحدث مع الوكيل هنا
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <a href={nabrah.directLink} target="_blank" rel="noopener noreferrer">فتح في نافذة جديدة</a>
                    </Button>
                  </>
                ) : null}

              </div>
              {nabrah.webhookUrl ? (
                <div className="space-y-2">
                  <Label>رابط الويب هوك (يُضبط تلقائيًا، وهذه نسخة احتياطية)</Label>
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

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>تجربة الاتصال الصوتي</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            اسمح للمتصفح باستخدام الميكروفون، ثم تحدث مع الوكيل للتأكد من ردوده ومعلوماته.
          </p>
          {nabrah?.directLink ? (
            <iframe
              title="تجربة الوكيل الصوتي"
              src={nabrah.directLink}
              allow="microphone; autoplay"
              className="h-[60vh] w-full rounded-lg border"
            />
          ) : null}
        </DialogContent>
      </Dialog>




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
