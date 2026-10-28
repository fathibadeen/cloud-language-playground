import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, MessageCircle, Mic, Zap } from "lucide-react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { SOLUTIONS } from "@/components/IndustrySolutions";
import callcenter from "@/assets/solutions/callcenter.jpg.asset.json";
import clinic from "@/assets/solutions/clinic.jpg.asset.json";
import law from "@/assets/solutions/law.jpg.asset.json";
import realestate from "@/assets/solutions/realestate.jpg.asset.json";
import restaurant from "@/assets/solutions/restaurant.jpg.asset.json";
import salon from "@/assets/solutions/salon.jpg.asset.json";
import logistics from "@/assets/solutions/logistics.jpg.asset.json";

const IMAGES = [clinic, law, realestate, restaurant, salon, callcenter, logistics].map((a) => a.url);

const title = "حلولنا لكل قطاع | صوتي — منتج من مسور";
const description = "وكيل ذكي يكلّم عملاءك بلهجتهم: مكالمات وواتساب وأتمتة للعيادات والمحاماة والعقارات والمطاعم والصالونات والتحصيل واللوجستيات.";

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

function Reveal({ from, children }: { from: "right" | "left"; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const off = from === "right" ? "translate-x-24" : "-translate-x-24";
  return (
    <div ref={ref} className={`transition-all duration-1000 ease-out ${shown ? "translate-x-0 opacity-100" : `${off} opacity-0`}`}>
      {children}
    </div>
  );
}

function SolutionsPage() {
  return (
    <PublicPageShell>
      <div dir="rtl" className="overflow-x-hidden">
        <section className="mx-auto max-w-5xl px-4 py-20 text-center md:px-8">
          <span className="text-base font-semibold text-saudi-bright">حلولنا</span>
          <h1 className="mt-4 font-display text-4xl font-bold md:text-6xl">وكيل ذكي يكلّم عملاءك بلهجتهم.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-xl leading-9 text-landing-muted">وكيل صوتي بلهجة سعودية طبيعية مع أتمتة واتساب — يرد خلال ثانيتين، 24/7، ويحوّل للموظف متى احتاج العميل.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
            {[{ i: Mic, t: "مكالمات" }, { i: MessageCircle, t: "واتساب" }, { i: Zap, t: "أتمتة" }].map(({ i: I, t }) => (
              <span key={t} className="inline-flex items-center gap-2 rounded-full border border-landing-foreground/15 px-4 py-2"><I className="size-4 text-saudi-bright" />{t}</span>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl space-y-16 px-4 pb-20 md:px-8">
          <div className="text-center">
            <span className="text-sm font-semibold text-saudi-bright">تفاصيل الحلول</span>
            <h2 className="mt-3 font-display text-3xl font-bold md:text-5xl">حل لكل قطاع، <span className="text-saudi-bright">بنفس الذكاء.</span></h2>
          </div>
          {SOLUTIONS.map((s, i) => (
            <Reveal key={s.title} from={i % 2 === 0 ? "right" : "left"}>
              <article className="sol-card grid items-center gap-8 overflow-hidden rounded-3xl border border-landing-foreground/15 bg-landing md:grid-cols-2"
                style={{ ["--a" as string]: s.accent }}>
                <div className={`h-64 overflow-hidden md:h-full ${i % 2 ? "md:order-2" : ""}`}>
                  <img src={IMAGES[i % IMAGES.length]} alt={s.title} loading="lazy" width={1024} height={768} className="size-full object-cover transition-transform duration-700 hover:scale-105" />
                </div>
                <div className="p-7 md:p-10">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--a)] px-3 py-1 text-sm font-semibold text-[var(--a)]"><s.icon className="size-4" />{s.badge}</span>
                  <h3 className="mt-5 text-3xl font-bold">{s.title}</h3>
                  <p className="mt-3 text-lg leading-8 text-landing-muted">{s.pain}</p>
                  <ul className="mt-5 space-y-3">
                    {s.points.map((p) => <li key={p} className="flex gap-2 leading-7"><Check className="mt-1 size-5 shrink-0 text-[var(--a)]" />{p}</li>)}
                  </ul>
                  <Link to={s.to ?? "/contact"} className="mt-7 inline-flex items-center gap-2 font-semibold text-[var(--a)] hover:underline">
                    {s.to ? "اكتشف الحل" : "اطلب تجربة مخصصة"}<ArrowLeft className="size-4" />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-24 text-center md:px-8">
          <h2 className="font-display text-3xl font-bold">جرّب الوكيل الصوتي على نشاطك</h2>
          <p className="mt-3 text-landing-muted">نجهز لك تجربة مخصصة بلهجة سعودية وواتساب.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/" className="rounded-2xl bg-saudi-bright px-7 py-4 text-lg font-bold text-mw-night">اسمع مكالمة تجريبية</Link>
            <Link to="/contact" className="rounded-2xl border border-landing-foreground/30 px-7 py-4 text-lg font-bold">اطلب تجربة مخصصة</Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
