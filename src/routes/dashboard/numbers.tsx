import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { saveProviderCredentials, testProviderConnection } from "@/lib/credentials.functions";

export const Route = createFileRoute("/dashboard/numbers")({
  component: NumbersPage,
});

type Num = {
  id: string;
  phone_number: string;
  country: string;
  provider: string;
  sip_status: string;
  provider_status: string;
  agent_id: string | null;
  is_active: boolean;
};

const PROVIDERS = ["didhub", "twilio", "saudi_sip", "generic_sip"];

function NumbersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const { data: numbers, isLoading } = useCompanyTable<Num>("phone_numbers", companyId);
  const { data: agents } = useCompanyTable<{ id: string; name: string; channel: string }>(
    "ai_agents",
    companyId,
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone_number: "", country: "SA", provider: "generic_sip" });
  const [sip, setSip] = useState({ username: "", password: "", uri: "", domain: "" });
  const [busy, setBusy] = useState(false);

  async function addNumber() {
    if (!companyId) return;
    const { error } = await supabase.from("phone_numbers").insert({ company_id: companyId, ...form });
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["phone_numbers"] });
  }

  async function assign(id: string, agentId: string) {
    const { error } = await supabase
      .from("phone_numbers")
      .update({ agent_id: agentId === "none" ? null : agentId })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["phone_numbers"] });
  }

  async function saveSip() {
    if (!companyId) return;
    setBusy(true);
    try {
      await saveProviderCredentials({
        data: {
          companyId,
          scope: "sip",
          provider: form.provider,
          secrets: {
            username: sip.username,
            password: sip.password,
            uri: sip.uri,
            domain: sip.domain,
          },
        },
      });
      setSip({ username: "", password: "", uri: "", domain: "" });
      toast.success(t("saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function testConn() {
    if (!companyId) return;
    const res = await testProviderConnection({ data: { companyId, scope: "sip" } });
    toast.message(res.status === "not_connected" ? t("notConnected") : t("testing"), {
      description: res.reason,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("navNumbers")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              {t("addNumber")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addNumber")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("phoneNumber")}</Label>
                <Input
                  dir="ltr"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("country")}</Label>
                <Input
                  dir="ltr"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
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
              <Button className="w-full" onClick={addNumber} disabled={!form.phone_number}>
                {t("create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (numbers ?? []).length === 0 ? (
        <EmptyState text={t("empty")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {numbers!.map((n) => (
            <Card key={n.id} className="shadow-none">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold" dir="ltr">
                    {n.phone_number}
                  </p>
                  <Badge variant="secondary">{n.provider}</Badge>
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant={n.sip_status === "connected" ? "default" : "secondary"}>
                    SIP: {t(n.sip_status === "connected" ? "connected" : "notConnected")}
                  </Badge>
                  <Badge variant={n.provider_status === "connected" ? "default" : "secondary"}>
                    {t(n.provider_status === "connected" ? "connected" : "notConnected")}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">{t("assignedAgent")}</Label>
                  <Select value={n.agent_id ?? "none"} onValueChange={(v) => assign(n.id, v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {(agents ?? [])
                        .filter((a) => a.channel === "voice")
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
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" />
            {t("sipConfig")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("credentialsServerOnly")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("sipUsername")}</Label>
              <Input dir="ltr" value={sip.username} onChange={(e) => setSip({ ...sip, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("sipPassword")}</Label>
              <Input
                dir="ltr"
                type="password"
                value={sip.password}
                onChange={(e) => setSip({ ...sip, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("sipUri")}</Label>
              <Input dir="ltr" value={sip.uri} onChange={(e) => setSip({ ...sip, uri: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("sipDomain")}</Label>
              <Input dir="ltr" value={sip.domain} onChange={(e) => setSip({ ...sip, domain: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSip} disabled={busy || !sip.username}>
              {t("save")}
            </Button>
            <Button variant="outline" onClick={testConn}>
              {t("testConnection")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
