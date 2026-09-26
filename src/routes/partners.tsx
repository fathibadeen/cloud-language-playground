import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpLeft, Building2, Lightbulb } from "lucide-react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import meswarLogo from "@/assets/brand/meswar-logo.jpg.asset.json";
import aiConsultingLogo from "@/assets/brand/ai-consulting-logo.jpg.asset.json";

const pageUrl = "https://www.sawti-ai.com/partners";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "شركاء منصة صوتي | مسور واستشارات الذكاء" },
      { name: "description", content: "تعرّف على مسور، الشركة المطورة لصوتي، واستشارات الذكاء ودورهما ضمن منظومة منصة صوتي." },
      { property: "og:title", content: "شركاء منصة صوتي | مسور واستشارات الذكاء" },
      { property: "og:description", content: "شراكات تقنية ومعرفية تجمع التطوير واستشارات الذكاء الاصطناعي ضمن منظومة صوتي." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: pageUrl }],
  }),
  component: PartnersPage,
});

function PartnersPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const partners = [
    {
      name: ar ? "مسور المتطورة" : "Meswar",
      role: ar ? "الشركة المطوّرة والجهة الأم" : "Developer and parent company",
      description: ar
        ? "شركة تقنية سعودية تطوّر المواقع والمنصات والأنظمة وحلول الذكاء الاصطناعي. طوّرت صوتي وتربط الفكرة والاستشارة بالتصميم والتنفيذ حتى يصبح الحل منتجًا قابلًا للنمو."
        : "A Saudi technology company building websites, platforms, systems, and AI solutions. Meswar developed Sawti and connects strategy, design, and delivery into products built to grow.",
      url: "https://meswar.com/",
      logo: meswarLogo.url,
      logoAlt: ar ? "شعار مسور" : "Meswar logo",
      icon: Building2,
      dark: true,
    },
    {
      name: ar ? "استشارات الذكاء" : "AI Consulting",
      role: ar ? "شريك التقييم والاستشارات" : "Assessment and consulting partner",
      description: ar
        ? "منصة تقييم واستشارات للشركات السعودية، تحلل عمليات الشركة وتكتشف فرص الذكاء الاصطناعي والأتمتة، ثم تحوّلها إلى أولويات واضحة وخطة تنفيذ عملية."
        : "An assessment and consulting platform for Saudi companies that analyzes operations, identifies AI and automation opportunities, and turns them into clear priorities and an actionable plan.",
      url: "https://www.meswar.com/Agent/",
      logo: aiConsultingLogo.url,
      logoAlt: ar ? "شعار استشارات الذكاء" : "AI Consulting logo",
      icon: Lightbulb,
      dark: false,
    },
  ];

  return (
    <PublicPageShell>
      <section className="border-b border-landing-foreground/10 bg-saudi/25 py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4 text-center md:px-8">
          <p className="font-semibold text-gold">{ar ? "منظومة متكاملة" : "ONE ECOSYSTEM"}</p>
          <h1 className="mt-4 font-display text-4xl font-bold md:text-6xl">{ar ? "شركاء منصة صوتي" : "Sawti platform partners"}</h1>
          <p className="mx-auto mt-6 max-w-3xl text-xl leading-9 text-landing-muted">
            {ar ? "خبرات تقنية ومعرفية تكمل بعضها لتقديم صوتي كمنتج سعودي يخدم تواصل الشركات بوضوح وكفاءة." : "Technology and consulting expertise working together to deliver Sawti as a Saudi product for clearer, more efficient business communication."}
          </p>
          <p className="mt-5 text-base font-semibold text-landing-foreground">{ar ? "صوتي — منتج من مسور" : "Sawti — A Meswar product"}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-24">
        <div className="grid gap-6 md:grid-cols-2">
          {partners.map((partner) => {
            const Icon = partner.icon;
            return (
              <article key={partner.url} className="flex flex-col overflow-hidden rounded-lg border border-landing-foreground/10 bg-landing">
                <div className={`flex h-56 items-center justify-center p-7 ${partner.dark ? "bg-primary" : "bg-saudi/25"}`}>
                  <img src={partner.logo} alt={partner.logoAlt} className="max-h-36 w-auto max-w-full object-contain" />
                </div>
                <div className="flex flex-1 flex-col p-7 md:p-8">
                  <div className="flex items-center gap-3 text-saudi-bright"><Icon className="size-6" /><span className="text-base font-semibold">{partner.role}</span></div>
                  <h2 className="mt-5 font-display text-3xl font-bold">{partner.name}</h2>
                  <p className="mt-4 flex-1 text-lg leading-8 text-landing-muted">{partner.description}</p>
                  <Button asChild variant="outline" className="mt-7 self-start">
                    <a href={partner.url} target="_blank" rel="noreferrer">{ar ? "زيارة الموقع الرسمي" : "Visit official website"}<ArrowUpLeft className="size-4 ltr:rotate-90" /></a>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </PublicPageShell>
  );
}