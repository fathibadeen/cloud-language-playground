import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { useCompanyId } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/usage")({
  head: () => ({ meta: [{ title: "الاستخدام | صوتي" }, { name: "description", content: "متابعة استخدام شركتك وحدود خطتها في صوتي." }, { property: "og:title", content: "الاستخدام | صوتي" }, { property: "og:description", content: "متابعة استخدام شركتك وحدود خطتها في صوتي." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: UsagePage,
});

type Row = { key: string; label: string; used: number; limit: number };

function UsagePage() {
  const { t } = useI18n();
  const companyId = useCompanyId();

  const { data } = useQuery({
    queryKey: ["usage-summary", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Row[]> => {
      const id = companyId!;
      const metric = async (m: string) => {
        const { data, error } = await supabase.rpc("company_usage_this_month", {
          _company_id: id,
          _metric: m,
        });
        if (error) throw error;
        return Number(data ?? 0);
      };
      const limit = async (k: string) => {
        const { data, error } = await supabase.rpc("company_limit", {
          _company_id: id,
          _key: k,
        });
        if (error) throw error;
        return Number(data ?? 0);
      };
      const count = async (table: "ai_agents" | "knowledge_documents" | "company_members") => {
        const { count, error } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("company_id", id);
        if (error) throw error;
        return count ?? 0;
      };

      const [minutes, messages, agents, documents, members] = await Promise.all([
        metric("voice_minutes"),
        metric("whatsapp_messages"),
        count("ai_agents"),
        count("knowledge_documents"),
        count("company_members"),
      ]);
      const [minutesLimit, messagesLimit, agentsLimit, documentsLimit, membersLimit] =
        await Promise.all([
          limit("voice_minutes"),
          limit("whatsapp_messages"),
          limit("agents"),
          limit("documents"),
          limit("members"),
        ]);

      return [
        { key: "minutesUsed", label: t("minutesUsed"), used: Math.round(minutes), limit: minutesLimit },
        { key: "messagesUsed", label: t("messagesUsed"), used: Math.round(messages), limit: messagesLimit },
        { key: "agentsUsed", label: t("agentsUsed"), used: agents, limit: agentsLimit },
        { key: "documentsUsed", label: t("documentsUsed"), used: documents, limit: documentsLimit },
        { key: "membersUsed", label: t("membersUsed"), used: members, limit: membersLimit },
      ];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("navUsage")}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {(data ?? []).map((r) => {
          const pct = r.limit ? Math.min(100, Math.round((r.used / r.limit) * 100)) : 0;
          return (
            <Card key={r.key}>
              <CardHeader>
                <CardTitle className="text-base">{r.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-semibold tabular-nums">
                  {r.used} <span className="text-sm text-muted-foreground">/ {r.limit}</span>
                </p>
                <Progress value={pct} />
                <p className="text-xs text-muted-foreground">
                  {pct >= 80 ? t("usageWarning") : `${t("remaining")}: ${Math.max(0, r.limit - r.used)}`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
