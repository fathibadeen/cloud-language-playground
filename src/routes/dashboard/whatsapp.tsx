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

  const company = membership?.companies as { id: string; name: string; whatsapp_enabled: boolean } | null;
  const account = accounts?.[0];
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
