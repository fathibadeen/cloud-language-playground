import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { saveProviderCredentials, testProviderConnection } from "@/lib/credentials.functions";

export const Route = createFileRoute("/dashboard/whatsapp")({
  component: WhatsappPage,
});

const PROVIDERS = ["meta_cloud", "twilio", "360dialog", "other_bsp"];

type Account = {
  id: string;
  provider: string;
  phone_number: string | null;
  business_account_id: string | null;
  status: string;
  agent_id: string | null;
  is_active: boolean;
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
  const [form, setForm] = useState({
    provider: "meta_cloud",
    phone_number: "",
    business_account_id: "",
    token: "",
  });

  const company = membership?.companies as { id: string; whatsapp_enabled: boolean } | null;
  const account = accounts?.[0];

  async function connect() {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("whatsapp_accounts")
      .insert({
        company_id: companyId,
        provider: form.provider,
        phone_number: form.phone_number,
        business_account_id: form.business_account_id,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    if (form.token) {
      await saveProviderCredentials({
        data: {
          companyId,
          scope: "whatsapp",
          provider: form.provider,
          referenceId: data.id,
          secrets: { access_token: form.token },
        },
      });
    }
    setForm({ ...form, token: "" });
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["whatsapp_accounts"] });
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

  async function test() {
    if (!companyId) return;
    const res = await testProviderConnection({ data: { companyId, scope: "whatsapp" } });
    toast.message(res.status === "not_connected" ? t("notConnected") : t("testing"), {
      description: res.reason,
    });
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("connectWhatsapp")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {account ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={account.status === "connected" ? "default" : "secondary"}>
                  {t(account.status === "connected" ? "connected" : "notConnected")}
                </Badge>
                <Badge variant="secondary">{account.provider}</Badge>
                <span dir="ltr" className="text-sm">
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
              <Button variant="outline" onClick={test}>
                {t("testConnection")}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("credentialsServerOnly")}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("provider")}</Label>
                  <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("phoneNumber")}</Label>
                  <Input
                    dir="ltr"
                    value={form.phone_number}
                    onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("businessAccountId")}</Label>
                  <Input
                    dir="ltr"
                    value={form.business_account_id}
                    onChange={(e) => setForm({ ...form, business_account_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("accessToken")}</Label>
                  <Input
                    dir="ltr"
                    type="password"
                    value={form.token}
                    onChange={(e) => setForm({ ...form, token: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={connect} disabled={!form.phone_number}>
                {t("connectWhatsapp")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
