import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/StatCard";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useCompanyId, useCompanyTable } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/conversations")({
  component: ConversationsPage,
});

type Conv = {
  id: string;
  channel: "voice" | "whatsapp";
  status: string;
  subject: string | null;
  summary: string | null;
  created_at: string;
  last_message_at: string | null;
  customer_id: string | null;
};

function ConversationsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { data: conversations, isLoading } = useCompanyTable<Conv>("conversations", companyId);
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      (conversations ?? []).filter(
        (c) => (channel === "all" || c.channel === channel) && (status === "all" || c.status === status),
      ),
    [conversations, channel, status],
  );

  const { data: messages } = useQuery({
    queryKey: ["messages", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selected!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  async function takeOver(id: string) {
    const { error } = await supabase
      .from("conversations")
      .update({ status: "human", assigned_user_id: user?.id ?? null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("inbox")}</h1>

      <div className="flex flex-wrap gap-3">
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allChannels")}</SelectItem>
            <SelectItem value="voice">{t("voice")}</SelectItem>
            <SelectItem value="whatsapp">{t("whatsapp")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="open">{t("open")}</SelectItem>
            <SelectItem value="needs_human">{t("needsHuman")}</SelectItem>
            <SelectItem value="human">{t("agentRole")}</SelectItem>
            <SelectItem value="closed">{t("closed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <EmptyState text={t("empty")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1">
            {filtered.map((c) => (
              <button key={c.id} className="w-full text-start" onClick={() => setSelected(c.id)}>
                <Card className={selected === c.id ? "border-primary shadow-none" : "shadow-none"}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {c.subject ?? (c.channel === "voice" ? t("voice") : t("whatsapp"))}
                      </span>
                      <Badge variant={c.status === "needs_human" ? "destructive" : "secondary"}>
                        {t(
                          c.status === "needs_human"
                            ? "needsHuman"
                            : c.status === "closed"
                              ? "closed"
                              : "open",
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.last_message_at ?? c.created_at).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>

          <Card className="lg:col-span-2">
            <CardContent className="space-y-3 p-5">
              {!selected ? (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => takeOver(selected)}>
                    {t("takeOver")}
                  </Button>
                  <div className="space-y-2">
                    {(messages ?? []).map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-lg p-3 text-sm ${
                          m.sender === "customer" ? "bg-secondary" : "bg-primary/10"
                        }`}
                      >
                        <p className="mb-1 text-xs text-muted-foreground">{m.sender}</p>
                        {m.body}
                      </div>
                    ))}
                    {(messages ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("empty")}</p>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
