import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Phone,
  MessageSquare,
  BookOpen,
  Users,
  BarChart3,
  ShieldCheck,
  Check,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";
import { usePlans } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منصة ذكاء | موظفك الذكي للرد على عملائك 24/7" },
      {
        name: "description",
        content:
          "وكلاء ذكاء اصطناعي للمكالمات وواتساب للشركات السعودية، مع قاعدة معرفة خاصة بكل شركة وتحويل للموظفين.",
      },
      { property: "og:title", content: "منصة ذكاء | موظفك الذكي للرد على عملائك 24/7" },
      {
        property: "og:description",
        content: "وكلاء ذكاء اصطناعي للمكالمات وواتساب للشركات السعودية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { data: plans } = usePlans();

  const features = [
    { icon: Phone, k: "featVoice", d: "featVoiceDesc" },
    { icon: MessageSquare, k: "featWa", d: "featWaDesc" },
    { icon: BookOpen, k: "featKb", d: "featKbDesc" },
    { icon: Users, k: "featHandoff", d: "featHandoffDesc" },
    { icon: BarChart3, k: "featAnalytics", d: "featAnalyticsDesc" },
    {
      icon: ShieldCheck,
      k: "multiTenant",
      d: "multiTenantDesc",
      labels: {
        ar: ["عزل كامل للبيانات", "كل شركة ببياناتها ووكلائها وقاعدة معرفتها المستقلة تمامًا."],
        en: ["Full data isolation", "Every company gets its own data, agents and knowledge base."],
      },
    },
  ];

  const steps = [
    ["step1", "step1d"],
    ["step2", "step2d"],
    ["step3", "step3d"],
    ["step4", "step4d"],
  ];

  const faqs =
    locale === "ar"
      ? [
          ["هل يدعم الوكيل اللهجة السعودية؟", "نعم، يمكن ضبط شخصية الوكيل ولغته وأسلوب رده لكل شركة."],
          ["كيف يتم ربط رقم الهاتف؟", "عبر مزود SIP أو مزود أرقام؛ المنصة تدعم عدة مزودين دون تغيير في البنية."],
          ["هل بياناتي معزولة عن بقية الشركات؟", "نعم، العزل على مستوى قاعدة البيانات عبر سياسات أمان صارمة."],
          ["هل يمكن تحويل العميل لموظف بشري؟", "نعم، للمكالمات عبر تحويل الرقم، ولواتساب عبر وضع «يحتاج موظفًا»."],
        ]
      : [
          ["Does the agent support Saudi dialect?", "Yes — tone, language and style are configurable per company."],
          ["How do I connect a phone number?", "Through a SIP or number provider; multiple providers are supported."],
          ["Is my data isolated?", "Yes, isolation is enforced at the database level with strict security policies."],
          ["Can a human take over?", "Yes — call transfer for voice, and a 'needs human' state for WhatsApp."],
        ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
              ذ
            </span>
            <span className="font-semibold">{t("brandFull")}</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              {t("features")}
            </a>
            <a href="#how" className="hover:text-foreground">
              {t("howItWorks")}
            </a>
            <a href="#pricing" className="hover:text-foreground">
              {t("pricing")}
            </a>
            <a href="#faq" className="hover:text-foreground">
              {t("faq")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            {user ? (
              <Button asChild size="sm">
                <Link to="/dashboard">{t("navHome")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">{t("login")}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    {t("startNow")}
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs text-secondary-foreground">
          {locale === "ar" ? "منصة سعودية متعددة الشركات" : "Saudi multi-tenant SaaS"}
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          {t("tagline")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{t("heroSub")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>
              {t("startNow")}
              <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#pricing">{t("pricing")}</a>
          </Button>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">{t("features")}</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.k} className="shadow-none">
              <CardContent className="space-y-3 p-6">
                <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="font-semibold">{f.labels ? f.labels[locale][0] : t(f.k)}</h3>
                <p className="text-sm text-muted-foreground">
                  {f.labels ? f.labels[locale][1] : t(f.d)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="how" className="border-y bg-secondary/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">{t("howItWorks")}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {steps.map(([k, d], i) => (
              <div key={k} className="rounded-xl border bg-card p-6">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{t(k)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(d)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">{t("pricing")}</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {(plans ?? []).map((p, i) => (
            <Card key={p.id} className={i === 1 ? "border-primary shadow-card" : "shadow-none"}>
              <CardContent className="space-y-4 p-6">
                <h3 className="text-lg font-semibold">{locale === "ar" ? p.name_ar : p.name_en}</h3>
                <p className="text-3xl font-bold">
                  {Number(p.price_sar).toFixed(0)}
                  <span className="ms-2 text-sm font-normal text-muted-foreground">
                    {t("perMonth")}
                  </span>
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-primary" />
                    {p.voice_minutes} {t("voiceMinutes")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-primary" />
                    {p.whatsapp_messages} {t("whatsappMessages")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-primary" />
                    {p.max_agents} {t("navAgents")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-primary" />
                    {p.max_members} {t("navTeam")}
                  </li>
                </ul>
                <Button asChild className="w-full" variant={i === 1 ? "default" : "outline"}>
                  <Link to="/auth" search={{ mode: "signup" }}>
                    {t("choosePlan")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">{t("faq")}</h2>
        <Accordion type="single" collapsible className="mt-8">
          {faqs.map(([q, a], i) => (
            <AccordionItem key={i} value={`i${i}`}>
              <AccordionTrigger className="text-start">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <footer id="contact" className="border-t py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{t("brandFull")}</span>
          <span>info@thakaa.sa</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
