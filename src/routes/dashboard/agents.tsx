import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/StatCard";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import { humanizeDbError } from "@/lib/errors";
import { AgentTester } from "@/components/AgentTester";
import { syncNabrahAgentMeta, unlinkNabrahAgent } from "@/lib/nabrah.functions";


export const Route = createFileRoute("/dashboard/agents")({
  head: () => ({ meta: [{ title: "الوكلاء الذكيون | صوتي" }, { name: "description", content: "إدارة وكلاء شركتك الذكيين في صوتي." }, { property: "og:title", content: "الوكلاء الذكيون | صوتي" }, { property: "og:description", content: "إدارة وكلاء شركتك الذكيين في صوتي." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AgentsPage,
});

type Agent = {
  id: string;
  name: string;
  channel: "voice" | "whatsapp";
  language: "ar" | "en";
  is_active: boolean;
  provider_agent_id: string | null;
  greeting: string | null;
};

function AgentsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const { data: agents, isLoading } = useCompanyTable<Agent>("ai_agents", companyId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    channel: "voice",
    language: "ar",
    personality: "",
    system_instructions: "",
    greeting: "",
    fallback_response: "",
    transfer_number: "",
  });

  async function create() {
    if (!companyId) return;
    const { error } = await supabase.from("ai_agents").insert({
      company_id: companyId,
      ...form,
      channel: form.channel as "voice" | "whatsapp",
      language: form.language as "ar" | "en",
    });
    if (error) { toast.error(humanizeDbError(error.message, t)); return; }
    toast.success(t("saved"));
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["ai_agents"] });
  }

  async function toggle(agent: Agent) {
    const { error } = await supabase
      .from("ai_agents")
      .update({ is_active: !agent.is_active })
      .eq("id", agent.id);
    if (error) { toast.error(humanizeDbError(error.message, t)); return; }
    qc.invalidateQueries({ queryKey: ["ai_agents"] });
  }

  const syncMeta = useServerFn(syncNabrahAgentMeta);
  const unlink = useServerFn(unlinkNabrahAgent);
  const [busy, setBusy] = useState(false);

  async function syncWithNabrah() {
    if (!companyId) return;
    setBusy(true);
    try {
      const res = await syncMeta({ data: { companyId } });
      if (res.reason === "no_linked_agent") toast.error("لا يوجد وكيل مرتبط بعد");
      else if (res.reason) toast.error(res.reason);
      else
        toast.success(
          res.missing > 0
            ? `تمت المزامنة: ${res.checked} وكيل، ${res.missing} غير موجود في نبرة`
            : `تمت المزامنة: ${res.checked} وكيل متصل`,
        );
      qc.invalidateQueries({ queryKey: ["ai_agents"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function unlinkAgent(agent: Agent) {
    if (!companyId) return;
    if (!confirm(`فك ربط "${agent.name}" عن نبرة؟ سيبقى الوكيل في حسابك بنبرة.`)) return;
    try {
      await unlink({ data: { companyId, agentId: agent.id } });
      toast.success("تم فك الربط");
      qc.invalidateQueries({ queryKey: ["ai_agents"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(agent: Agent) {
    if (!confirm(`حذف الوكيل "${agent.name}" من صوتي نهائيًا؟`)) return;
    const { error } = await supabase.from("ai_agents").delete().eq("id", agent.id);
    if (error) {
      toast.error(
        error.message.includes("foreign key")
          ? "لا يمكن الحذف لارتباط الوكيل بمكالمات أو محادثات سابقة. يمكنك تعطيله بدلًا من ذلك."
          : humanizeDbError(error.message, t),
      );
      return;
    }
    toast.success("تم حذف الوكيل");
    qc.invalidateQueries({ queryKey: ["ai_agents"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("navAgents")}</h1>

        <Button variant="outline" className="gap-2" onClick={syncWithNabrah} disabled={busy}>
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          مزامنة مع نبرة
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>

          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              {t("newAgent")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("newAgent")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("agentName")}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("channel")}</Label>
                  <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voice">{t("voice")}</SelectItem>
                      <SelectItem value="whatsapp">{t("whatsapp")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("language")}</Label>
                  <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ar">{t("arabic")}</SelectItem>
                      <SelectItem value="en">{t("english")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("personality")}</Label>
                <Input
                  value={form.personality}
                  onChange={(e) => setForm({ ...form, personality: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("greeting")}</Label>
                <Textarea
                  rows={2}
                  value={form.greeting}
                  onChange={(e) => setForm({ ...form, greeting: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("instructions")}</Label>
                <Textarea
                  rows={4}
                  value={form.system_instructions}
                  onChange={(e) => setForm({ ...form, system_instructions: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("fallback")}</Label>
                <Input
                  value={form.fallback_response}
                  onChange={(e) => setForm({ ...form, fallback_response: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("transferNumber")}</Label>
                <Input
                  dir="ltr"
                  value={form.transfer_number}
                  onChange={(e) => setForm({ ...form, transfer_number: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={create} disabled={!form.name}>
                {t("create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (agents ?? []).length === 0 ? (
        <EmptyState text={t("empty")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents!.map((a) => (
            <Card key={a.id} className="shadow-none">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.channel === "voice" ? t("voice") : t("whatsapp")} ·{" "}
                      {a.language === "ar" ? t("arabic") : t("english")}
                    </p>
                  </div>
                  <Switch checked={a.is_active} onCheckedChange={() => toggle(a)} />
                </div>
                {a.greeting ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{a.greeting}</p>
                ) : null}
                <Badge variant={a.provider_agent_id ? "default" : "secondary"}>
                  {a.provider_agent_id ? t("connected") : t("notConnected")}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
