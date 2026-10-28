import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, MessageCircle, Mic, Zap } from "lucide-react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { SOLUTIONS } from "@/components/IndustrySolutions";

const title = "حلولنا لكل قطاع | صوتي — منتج من مسور";
const description = "حلول صوتي الذكية للعيادات والمحاماة والعقارات والمطاعم والصالونات والتحصيل واللوجستيات: مكالمات وواتساب وأتمتة على مدار الساعة.";

export const Route = createFileRoute("/solutions")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://www.sawti-ai.com/solutions" }],
  }),
  component: SolutionsPage,
});

function SolutionsPage() {
  return (
    <PublicPageShell>
      <div dir="rtl">
        <section className="mx-auto max-w-5xl px-4 py-20 text-center md:px-8">
          <span className="text-base font-semibold text-gold">حلولنا</span>
          <h1 className="mt-4 font-display text-4xl font-bold md:text-6xl">حلول ذكية لكل قطاع</h1>
          <p className="mx-auto mt-6 max-w-3xl text-xl leading-9 text-landing-muted">وكيل واحد يرد على المكالمات وواتساب ويؤتمت المتابعة — مصمم حسب احتياج نشاطك.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
            {[{ i: Mic, t: "مكالمات" }, { i: MessageCircle, t: "واتساب" }, { i: Zap, t: "أتمتة" }].map(({ i: I, t }) => (
              <span key={t} className="inline-flex items-center gap-2 rounded-full border border-landing-foreground/15 px-4 py-2"><I className="size-4 text-saudi-bright" />{t}</span>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-20 md:grid-cols-2 md:px-8 lg:grid-cols-3">
          {SOLUTIONS.map((s) => (
            <article key={s.title} className="sol-card group flex flex-col rounded-2xl border border-landing-foreground/15 bg-landing p-7"
              style={{ ["--a" as string]: s.accent, backgroundImage: "linear-gradient(160deg, color-mix(in oklab, var(--a) 16%, transparent), transparent 55%)", borderTop: "3px solid var(--a)" }}>
              <div className="flex items-center justify-between">
                <span className="grid size-14 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--a)_20%,transparent)]"><s.icon className="size-7 text-[var(--a)]" /></span>
                <span className="rounded-full border border-[var(--a)] px-3 py-1 text-sm font-semibold text-[var(--a)]">{s.badge}</span>
              </div>
              <h2 className="mt-6 text-2xl font-bold">{s.title}</h2>
              <p className="mt-3 text-sm font-semibold text-landing-muted">التحدي</p>
              <p className="mt-1 text-base leading-7">{s.pain}</p>
              <p className="mt-5 text-sm font-semibold text-landing-muted">ماذا يفعل صوتي</p>
              <ul className="mt-2 space-y-2">
                {s.points.map((p) => <li key={p} className="flex gap-2 text-sm leading-6"><Check className="mt-0.5 size-4 shrink-0 text-[var(--a)]" />{p}</li>)}
              </ul>
              <p className="mt-5 rounded-xl bg-[color-mix(in_oklab,var(--a)_14%,transparent)] px-4 py-3 text-sm leading-6">{s.reply}</p>
              <div className="mt-auto pt-6">
                <Link to={s.to ?? "/contact"} className="inline-flex items-center gap-2 font-semibold text-[var(--a)] hover:underline">
                  {s.to ? "اكتشف الحل" : "اطلب عرضاً"}<ArrowLeft className="size-4" />
                </Link>
              </div>
            </article>
          ))}
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-24 text-center md:px-8">
          <h2 className="font-display text-3xl font-bold">جاهز تشوف صوتي في نشاطك؟</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/" className="rounded-2xl bg-saudi-bright px-7 py-4 text-lg font-bold text-saudi-foreground">اسمع مكالمة تجريبية</Link>
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-2xl border border-landing-foreground/30 px-7 py-4 text-lg font-bold">ابدأ مجاناً</Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
