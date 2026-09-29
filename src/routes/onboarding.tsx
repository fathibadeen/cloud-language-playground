import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useMembership, usePlans } from "@/lib/tenant";
import { ProductPlanCards, ProductToggle } from "@/components/ProductPlans";
import { plansFor, type PlanRow, type Product } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";
import { provisionCompanyVoice } from "@/lib/nabrah.functions";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إعداد الحساب | صوتي" },
      { name: "description", content: "أنشئ شركتك واضبط قنوات التواصل خلال دقائق." },
      { property: "og:title", content: "إعداد الحساب | صوتي" },
      { property: "og:description", content: "أنشئ شركتك واضبط قنوات التواصل خلال دقائق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

type Service = "voice" | "whatsapp" | "both";

function Onboarding() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const provision = useServerFn(provisionCompanyVoice);
  const { user, loading } = useAuth();
  const { data: membership, isLoading: memberLoading } = useMembership();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cr_number: "",
    industry: "",
    description: "",
    website: "",
    address: "",
    city: "",
    contact_phone: "",
    contact_email: "",
  });
  const [service, setService] = useState<Service>("both");
  const [planId, setPlanId] = useState<string | null>(null);
  const { data: plans } = usePlans();
  const product: Product = service === "both" ? "bundle" : service;
  const [knowledge, setKnowledge] = useState("");
  const [agentName, setAgentName] = useState("");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (membership?.company_id) navigate({ to: "/dashboard", replace: true });
  }, [membership, navigate]);

  useEffect(() => {
    if (user?.email) setForm((f) => ({ ...f, contact_email: f.contact_email || user.email! }));
  }, [user]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function finish() {
    if (!user) return;
    setBusy(true);
    try {
      const { data: companyId, error: cErr } = await supabase.rpc("create_company_with_owner", {
        _payload: { ...form, default_locale: locale },
        _service: service,
      });
      if (cErr) throw cErr;

      const { data: kb, error: kErr } = await supabase
        .from("knowledge_bases")
        .insert({
          company_id: companyId,
          name: locale === "ar" ? "قاعدة معرفة الشركة" : "Company knowledge base",
        })
        .select()
        .single();
      if (kErr) throw kErr;

      if (knowledge.trim()) {
        await supabase.from("knowledge_documents").insert({
          company_id: companyId,
          knowledge_base_id: kb.id,
          title: locale === "ar" ? "معلومات أساسية" : "Company basics",
          source_type: "text",
          content: knowledge,
        });
      }

      const channels: ("voice" | "whatsapp")[] =
        service === "both" ? ["voice", "whatsapp"] : [service];
      for (const ch of channels) {
        await supabase.from("ai_agents").insert({
          company_id: companyId,
          name: agentName || (locale === "ar" ? "وكيل خدمة العملاء" : "Customer service agent"),
          channel: ch,
          language: locale,
          greeting,
          knowledge_base_id: kb.id,
          provider: ch === "voice" ? "nabrah" : "whatsapp_provider",
        });
      }

      // لا توجد مدفوعات حاليًا — يبدأ الحساب بفترة تجريبية على الباقة المختارة
      const chosenPlan = planId ?? plansFor(plans as PlanRow[] | undefined, product)[0]?.id ?? null;
      await supabase.from("subscriptions").insert({
        company_id: companyId,
        status: "trialing",
        plan_id: chosenPlan,
      });

      // ربط الوكيل الصوتي تلقائيًا مع نبرة (لا يمنع دخول العميل إن فشل)
      if (channels.includes("voice") && typeof companyId === "string") {
        try {
          const res = await provision({ data: { companyId } });
          if (res.status === "connected") toast.success(t("voiceConnected"));
          else toast.message(t("voicePending"), { description: res.reason ?? undefined });
        } catch {
          toast.message(t("voicePending"));
        }
      }

      await qc.invalidateQueries();
      toast.success(t("saved"));
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || memberLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">{t("loading")}</div>;
  }

  const steps = [t("companyInfo"), t("chooseService"), t("navKnowledge"), t("navAgents")];

  return (
    <div className="min-h-screen bg-secondary/40">
      <div className="flex items-center justify-between p-4">
        <span className="font-semibold">{t("onboarding")}</span>
        <LanguageToggle variant="outline" />
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {steps.map((s, i) => (
            <span
              key={s}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                step === i + 1
                  ? "border-primary bg-primary text-primary-foreground"
                  : step > i + 1
                    ? "bg-card text-muted-foreground"
                    : "bg-card text-muted-foreground"
              }`}
            >
              {step > i + 1 ? <Check className="size-3" /> : <span>{i + 1}</span>}
              {s}
            </span>
          ))}
        </div>

        <Card>
          <CardContent className="space-y-5 p-6">
            {step === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>{t("companyName")}</Label>
                  <Input value={form.name} onChange={set("name")} required />
                </div>
                <div className="space-y-2">
                  <Label>{t("crNumber")}</Label>
                  <Input value={form.cr_number} onChange={set("cr_number")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("industry")}</Label>
                  <Input value={form.industry} onChange={set("industry")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("city")}</Label>
                  <Input value={form.city} onChange={set("city")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("contactPhone")}</Label>
                  <Input dir="ltr" value={form.contact_phone} onChange={set("contact_phone")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("website")}</Label>
                  <Input dir="ltr" value={form.website} onChange={set("website")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("email")}</Label>
                  <Input dir="ltr" value={form.contact_email} onChange={set("contact_email")} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t("address")}</Label>
                  <Input value={form.address} onChange={set("address")} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t("description")}</Label>
                  <Textarea value={form.description} onChange={set("description")} rows={3} />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <p className="text-lg font-semibold">{locale === "ar" ? "وش تحتاج؟" : "What do you need?"}</p>
                <ProductToggle
                  value={product}
                  onChange={(p) => { setService(p === "bundle" ? "both" : p); setPlanId(null); }}
                  ar={locale === "ar"}
                />
                <ProductPlanCards
                  plans={plans as PlanRow[] | undefined}
                  product={product}
                  ar={locale === "ar"}
                  selectedId={planId ?? plansFor(plans as PlanRow[] | undefined, product)[0]?.id ?? null}
                  onSelect={setPlanId}
                  perMonth={t("perMonth")}
                />
                <p className="text-sm text-muted-foreground">
                  {locale === "ar" ? "تبدأ بفترة تجريبية مجانية — بدون دفع الآن." : "You start with a free trial — no payment now."}
                </p>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-2">
                <Label>{t("content")}</Label>
                <Textarea
                  rows={8}
                  value={knowledge}
                  onChange={(e) => setKnowledge(e.target.value)}
                  placeholder={
                    locale === "ar"
                      ? "ساعات العمل، الخدمات، الأسعار، الأسئلة الشائعة…"
                      : "Working hours, services, pricing, FAQs…"
                  }
                />
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("agentName")}</Label>
                  <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("greeting")}</Label>
                  <Textarea rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)} />
                </div>
              </div>
            ) : null}

            <div className="flex justify-between pt-2">
              <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
                {t("back")}
              </Button>
              {step < 4 ? (
                <Button disabled={step === 1 && !form.name} onClick={() => setStep((s) => s + 1)}>
                  {t("next")}
                </Button>
              ) : (
                <Button onClick={finish} disabled={busy}>
                  {t("finish")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
