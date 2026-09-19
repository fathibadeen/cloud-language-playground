import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable, useSubscription } from "@/lib/tenant";

export const Route = createFileRoute("/dashboard/usage")({
  component: UsagePage,
});

type Usage = { id: string; metric: string; quantity: number; occurred_at: string };

function UsagePage() {
  const { t } = useI18n();
  const companyId = useCompanyId();
  const { data: subscription } = useSubscription(companyId);
  const { data: usage } = useCompanyTable<Usage>("usage_records", companyId);
  const { data: calls } = useCompanyTable<{ duration_seconds: number; created_at: string }>(
    "voice_calls",
    companyId,
  );
  const { data: conversations } = useCompanyTable<{ created_at: string }>("conversations", companyId);

  const plan = subscription?.plans as
    | { voice_minutes: number; whatsapp_messages: number; max_documents: number }
    | null;

  const monthStart = new Date();
  monthStart.setDate(1);

  const minutes = Math.round(
    (calls ?? [])
      .filter((c) => new Date(c.created_at) >= monthStart)
      .reduce((s, c) => s + c.duration_seconds, 0) / 60,
  );
  const messages = (conversations ?? []).filter((c) => new Date(c.created_at) >= monthStart).length;
  const searches = (usage ?? []).filter((u) => u.metric === "knowledge_search").length;

  const rows = [
    { label: t("voiceMinutes"), used: minutes, limit: plan?.voice_minutes ?? 0 },
    { label: t("whatsappMessages"), used: messages, limit: plan?.whatsapp_messages ?? 0 },
    { label: t("navKnowledge"), used: searches, limit: plan?.max_documents ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("navUsage")}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((r) => {
          const pct = r.limit ? Math.min(100, Math.round((r.used / r.limit) * 100)) : 0;
          return (
            <Card key={r.label}>
              <CardHeader>
                <CardTitle className="text-base">{r.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-semibold tabular-nums">
                  {r.used} <span className="text-sm text-muted-foreground">/ {r.limit}</span>
                </p>
                <Progress value={pct} />
                <p className="text-xs text-muted-foreground">
                  {t("remaining")}: {Math.max(0, r.limit - r.used)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
