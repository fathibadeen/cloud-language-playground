import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const url = "https://www.sawti-ai.com/contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل مع صوتي | دعم الشركات" },
      { name: "description", content: "تواصل مع فريق صوتي للاستفسار عن المكالمات الذكية وواتساب وإعداد حساب شركتك." },
      { property: "og:title", content: "تواصل مع صوتي | دعم الشركات" },
      { property: "og:description", content: "نساعدك في تجهيز صوتي لخدمة عملاء شركتك." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <PublicPageShell>
      <section className="mx-auto max-w-4xl px-4 py-20 md:px-8 md:py-28">
        <p className="font-semibold text-gold">{ar ? "نحن قريبون" : "WE'RE HERE"}</p>
        <h1 className="mt-4 font-display text-4xl font-bold md:text-6xl">{ar ? "تواصل مع فريق صوتي" : "Talk to the Sawti team"}</h1>
        <p className="mt-6 max-w-2xl text-xl leading-9 text-landing-muted">{ar ? "للاستفسارات، الدعم، أو تجهيز قنوات شركتك، راسلنا وسنعود إليك عبر البريد الإلكتروني." : "For questions, support, or help setting up your company channels, email us and our team will get back to you."}</p>
        <div className="mt-10 border-y border-landing-foreground/10 py-8">
          <h2 className="text-2xl font-semibold">{ar ? "البريد الإلكتروني" : "Email"}</h2>
          <p className="mt-2 text-lg text-landing-muted">support@sawti-ai.com</p>
          <Button asChild size="lg" className="mt-6"><a href="mailto:support@sawti-ai.com"><Mail />{ar ? "راسلنا" : "Email us"}</a></Button>
        </div>
      </section>
    </PublicPageShell>
  );
}