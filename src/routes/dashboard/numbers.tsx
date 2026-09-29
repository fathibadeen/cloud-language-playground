import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, PhoneCall, Plus, Settings2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { humanizeDbError } from "@/lib/errors";
import { saveProviderCredentials, testProviderConnection } from "@/lib/credentials.functions";
import {
  linkNabrahSipLine,
  listNabrahSipLines,
  provisionCompanyVoice,
  syncNabrahNumbers,
  unlinkNabrahSipLine,
} from "@/lib/nabrah.functions";
import { useQuery } from "@tanstack/react-query";

function NabrahSipCard({ companyId }: { companyId: string | null | undefined }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listNabrahSipLines);
  const linkFn = useServerFn(linkNabrahSipLine);
  const unlinkFn = useServerFn(unlinkNabrahSipLine);
  const importFn = useServerFn(syncNabrahNumbers);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["nabrah-sip", companyId],
    enabled: !!companyId,
    retry: false,
    queryFn: () => listFn({ data: { companyId: companyId! } }),
  });
  async function link(id: string) {
    const res = await linkFn({ data: { companyId: companyId!, inboundId: id } });
    if (res.ok) toast.success("تم ربط الخط بوكيل الشركة");
    else toast.error(res.reason === "no_linked_agent" ? "اربط وكيل نبرة من صفحة الوكيل الصوتي أولًا" : String(res.reason));
  }
  async function unlink(id: string) {
    const res = await unlinkFn({ data: { companyId: companyId!, inboundId: id } });
    if (res.ok) toast.success("تم فصل الخط عن الوكيل");
    else toast.error(res.reason === "no_linked_agent" ? "لا يوجد وكيل مرتبط" : String(res.reason));
  }
  async function importNumbers() {
    setBusy(true);
    try {
      const res = await importFn({ data: { companyId: companyId! } });
      if (res.reason === "no_numbers") toast.error("لا توجد أرقام في خطوط نبرة");
      else if (res.reason) toast.error(String(res.reason));
      else toast.success(res.imported > 0 ? `تمت إضافة ${res.imported} رقم` : "كل الأرقام موجودة مسبقًا");
      qc.invalidateQueries({ queryKey: ["phone_numbers"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!companyId || (data?.error === "not_configured")) return null;
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold">خطوط الاتصال في نبرة</div>
          <Button size="sm" variant="outline" onClick={importNumbers} disabled={busy}>
            مزامنة الأرقام
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          اربط رقمك عبر SIP بعنوان pbx.nabrah.ai:5060، ثم اربط الخط بوكيل الشركة هنا.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : !data?.lines.length ? (
          <p className="text-sm text-muted-foreground">لا توجد خطوط في حساب نبرة بعد.</p>
        ) : (
          data.lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{l.numbers}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => link(l.id)}>ربط بالوكيل</Button>
                <Button size="sm" variant="ghost" onClick={() => unlink(l.id)}>فصل</Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}


export const Route = createFileRoute("/dashboard/numbers")({
  head: () => ({ meta: [{ title: "أرقام الهاتف | صوتي" }, { name: "description", content: "إدارة أرقام الهاتف وقنوات الاتصال في صوتي." }, { property: "og:title", content: "أرقام الهاتف | صوتي" }, { property: "og:description", content: "إدارة أرقام الهاتف وقنوات الاتصال في صوتي." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
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

function statusKey(n: Num): "numberReady" | "numberPreparing" | "numberNeedsSetup" {
  if (n.provider_status === "connected" || n.sip_status === "connected") return "numberReady";
  if (n.provider === "nabrah") return "numberPreparing";
  return "numberNeedsSetup";
}

function NumbersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const provision = useServerFn(provisionCompanyVoice);
  const { data: numbers, isLoading } = useCompanyTable<Num>("phone_numbers", companyId);
  const { data: agents } = useCompanyTable<{ id: string; name: string; channel: string }>(
    "ai_agents",
    companyId,
  );
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<"choose" | "own">("choose");
  const [form, setForm] = useState({ phone_number: "", country: "SA", provider: "generic_sip" });
  const [sip, setSip] = useState({ username: "", password: "", uri: "", domain: "" });
  const [busy, setBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  async function autoProvision() {
    if (!companyId) return;
    setBusy(true);
    try {
      const res = await provision({ data: { companyId } });
      if (res.status === "connected") {
        toast.success(t("voiceConnected"));
        setOpen(false);
      } else {
        toast.message(t("numberPreparing"), { description: t("numberFailed") });
      }
      qc.invalidateQueries({ queryKey: ["phone_numbers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addNumber() {
    if (!companyId) return;
    const { error } = await supabase.from("phone_numbers").insert({ company_id: companyId, ...form });
    if (error) { toast.error(humanizeDbError(error.message, t)); return; }
    toast.success(t("saved"));
    setOpen(false);
    setPath("choose");
    qc.invalidateQueries({ queryKey: ["phone_numbers"] });
  }

  async function assign(id: string, agentId: string) {
    const { error } = await supabase
      .from("phone_numbers")
      .update({ agent_id: agentId === "none" ? null : agentId })
      .eq("id", id);
    if (error) { toast.error(humanizeDbError(error.message, t)); return; }
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
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setPath("choose");
          }}
        >
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

            {path === "choose" ? (
              <div className="grid gap-3">
                <button
                  onClick={autoProvision}
                  disabled={busy}
                  className="rounded-xl border-2 border-primary/40 bg-secondary/50 p-5 text-start transition-colors hover:border-primary hover:bg-secondary"
                >
                  <Wand2 className="size-6 text-primary" />
                  <p className="mt-2 font-semibold">{t("getReadyNumber")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("getReadyNumberDesc")}</p>
                  {busy ? <p className="mt-2 text-xs text-muted-foreground">{t("loading")}</p> : null}
                </button>
                <button
                  onClick={() => setPath("own")}
                  className="rounded-xl border p-5 text-start transition-colors hover:bg-secondary/50"
                >
                  <Settings2 className="size-6 text-muted-foreground" />
                  <p className="mt-2 font-semibold">{t("haveOwnNumber")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("haveOwnNumberDesc")}</p>
                </button>
              </div>
            ) : (
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
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPath("choose")}>
                    {t("back")}
                  </Button>
                  <Button className="flex-1" onClick={addNumber} disabled={!form.phone_number}>
                    {t("create")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (numbers ?? []).length === 0 ? (
        <EmptyState text={t("empty")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {numbers!.map((n) => {
            const key = statusKey(n);
            return (
              <Card key={n.id} className="shadow-none">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold" dir="ltr">
                      {n.phone_number}
                    </p>
                    <Badge variant={key === "numberReady" ? "default" : "secondary"}>
                      <PhoneCall className="me-1 size-3" />
                      {t(key)}
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
            );
          })}
        </div>
      )}

      <NabrahSipCard companyId={companyId} />

      <Card>
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center justify-between p-6"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Settings2 className="size-4 text-muted-foreground" />
            {t("advancedSettings")}
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${advancedOpen ? "rotate-180" : ""}`}
          />
        </button>
        {advancedOpen ? (
          <CardContent className="space-y-4 border-t pt-4">
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
        ) : null}
      </Card>
    </div>
  );
}
