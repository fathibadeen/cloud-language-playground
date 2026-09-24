import { createFileRoute } from "@tanstack/react-router";
import { Bot, PhoneCall, MessageSquare, Timer, Send, UserCheck } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable, useMembership, useSubscription } from "@/lib/tenant";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | صوتي" },
      { name: "description", content: "ملخص أداء قنوات التواصل والمكالمات والمحادثات في صوتي." },
      { property: "og:title", content: "لوحة التحكم | صوتي" },
      { property: "og:description", content: "ملخص أداء قنوات التواصل والمكالمات والمحادثات في صوتي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Overview,
});

type Row = { created_at: string; status?: string; duration_seconds?: number; is_active?: boolean; channel?: string };

function Overview() {
  const { t, locale } = useI18n();
  const companyId = useCompanyId();
  const { data: membership } = useMembership();
  const { data: subscription } = useSubscription(companyId);
  const { data: agents } = useCompanyTable<Row>("ai_agents", companyId);
  const { data: calls } = useCompanyTable<Row>("voice_calls", companyId);
  const { data: conversations } = useCompanyTable<Row>("conversations", companyId);

  const company = membership?.companies as
    | { name: string; voice_enabled: boolean; whatsapp_enabled: boolean }
    | null;

  const today = new Date().toDateString();
  const callsToday = (calls ?? []).filter((c) => new Date(c.created_at).toDateString() === today).length;
  const chatsToday = (conversations ?? []).filter(
    (c) => new Date(c.created_at).toDateString() === today && c.channel === "whatsapp",
  ).length;
  const minutes = Math.round((calls ?? []).reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / 60);
  const transfers = (conversations ?? []).filter((c) => c.status === "human" || c.status === "needs_human").length;
  const activeAgents = (agents ?? []).filter((a) => a.is_active).length;

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    return {
      day: d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { weekday: "short" }),
      calls: (calls ?? []).filter((c) => new Date(c.created_at).toDateString() === key).length,
      chats: (conversations ?? []).filter((c) => new Date(c.created_at).toDateString() === key).length,
    };
  });

  const plan = subscription?.plans as { name_ar: string; name_en: string } | null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-sidebar px-6 py-7 text-sidebar-foreground md:px-8">
        <p className="text-sm text-sidebar-primary">{locale === "ar" ? "حيّاك الله، هذه آخر المستجدات" : "Welcome back, here is the latest"}</p>
        <h1 className="mt-2 font-display text-2xl font-bold md:text-3xl">{company?.name}</h1>
        <p className="mt-2 text-sm text-sidebar-foreground/70">{locale === "ar" ? "أرقامك واضحة، وفريقك الذكي تحت النظر." : "Clear numbers and your AI team in view."}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("activeAgents")} value={activeAgents} icon={Bot} />
        <StatCard label={t("callsToday")} value={callsToday} icon={PhoneCall} />
        <StatCard label={t("waToday")} value={chatsToday} icon={MessageSquare} />
        <StatCard label={t("minutesUsed")} value={minutes} icon={Timer} />
        <StatCard label={t("messagesHandled")} value={(conversations ?? []).length} icon={Send} />
        <StatCard label={t("humanTransfers")} value={transfers} icon={UserCheck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("last7days")}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke="var(--color-chart-1)"
                  fill="var(--color-chart-1)"
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="chats"
                  stroke="var(--color-chart-2)"
                  fill="var(--color-chart-2)"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("serviceStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>{t("voiceService")}</span>
              <Badge variant={company?.voice_enabled ? "default" : "secondary"}>
                {company?.voice_enabled ? t("active") : t("inactive")}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("whatsappService")}</span>
              <Badge variant={company?.whatsapp_enabled ? "default" : "secondary"}>
                {company?.whatsapp_enabled ? t("active") : t("inactive")}
              </Badge>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span>{t("currentPlan")}</span>
              <span className="font-medium">
                {plan ? (locale === "ar" ? plan.name_ar : plan.name_en) : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
