import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, MessageCircle, Workflow, CalendarCheck, BellRing, ShieldCheck, Sparkles, ArrowLeft, CheckCircle2, Clock, BarChart3, Users } from "lucide-react";
import { SawtiLogo } from "@/components/SawtiLogo";
import meswarLogo from "@/assets/brand/meswar-logo.jpg.asset.json";
import heroImg from "@/assets/meswar-preview/hero-reception.jpg";
import autoImg from "@/assets/meswar-preview/automation.jpg";
import waImg from "@/assets/meswar-preview/whatsapp.jpg";

export const Route = createFileRoute("/preview-meswar")({
  head: () => ({
    meta: [
      { title: "صوتي من مسور — مكالمات وواتساب وأتمتة بالذكاء الاصطناعي (معاينة)" },
      { name: "description", content: "معاينة هوية صوتي الموحدة مع مسور: وكيل مكالمات، وكيل واتساب، وأتمتة للمواعيد والمتابعة في منصة واحدة." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "صوتي من مسور — مكالمات وواتساب وأتمتة" },
      { property: "og:description", content: "وكيل ذكي يرد على عملائك بالصوت والواتساب ويؤتمت المواعيد والمتابعة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MeswarPreview,
});

const pillars = [
  { icon: Phone, title: "وكيل المكالمات", desc: "يرد على كل مكالمة 24/7 بلهجة سعودية طبيعية، يجيب الأسئلة ويحجز المواعيد ويحوّل للموظف عند الحاجة.", points: ["لا مكالمة فائتة", "حجز وتعديل وإلغاء", "تنبيه تسجيل المكالمة"] },
  { icon: MessageCircle, title: "وكيل واتساب", desc: "يستقبل الاستفسارات ويرد فوراً من قاعدة معرفتك، ويرسل الموقع والتعليمات والتأكيدات داخل المحادثة.", points: ["رد فوري بالعربي", "حجز من المحادثة", "ربط رسمي مع Meta"] },
  { icon: Workflow, title: "الأتمتة الذكية", desc: "تذكيرات تلقائية، متابعة بعد الزيارة، استرجاع المتغيبين، وتنبيهات فورية لفريقك — بدون تدخل يدوي.", points: ["تذكير قبل 24 ساعة وساعتين", "متابعة المتغيبين", "مزامنة التقويم"] },
];

const flow = [
  { icon: Phone, t: "العميل يتصل", d: "الوكيل يرد ويفهم الطلب ويحجز موعداً" },
  { icon: MessageCircle, t: "تأكيد على واتساب", d: "رسالة تأكيد فورية مع الموقع والتعليمات" },
  { icon: BellRing, t: "تذكير تلقائي", d: "قبل الموعد بـ24 ساعة وساعتين" },
  { icon: CalendarCheck, t: "حضور ومتابعة", d: "متابعة بعد الزيارة أو موعد بديل للمتغيب" },
];

function MeswarPreview() {
  return (
    <div dir="rtl" className="theme-meswar min-h-screen bg-mw-bg font-sans text-mw-ink">
      <div className="bg-mw-bright py-2 text-center text-sm font-bold text-mw-night">صفحة معاينة للهوية الجديدة — الصفحة الرئيسية لم تتغير</div>

      <section className="mw-gridbg relative overflow-hidden bg-mw-night">
        <div className="pointer-events-none absolute -top-40 right-[-10%] size-[520px] rounded-full bg-mw-bright/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-30%] left-[-10%] size-[480px] rounded-full bg-mw-gold/20 blur-3xl" />
        <header className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-primary-foreground/95 px-3 py-1.5"><SawtiLogo compact /></div><span className="text-xs text-mw-mint/70">من</span><img src={meswarLogo.url} alt="مسور" className="h-9 w-auto rounded-md" /></div>
          <nav className="flex items-center gap-2">
            <Link to="/auth" className="rounded-xl border border-mw-mint/30 px-4 py-2 text-sm font-bold text-mw-mint hover:bg-mw-mint/10">دخول</Link>
            <Link to="/contact" className="rounded-xl bg-mw-bright px-4 py-2 text-sm font-bold text-mw-night">اطلب عرضاً</Link>
          </nav>
        </header>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-24 pt-10 md:px-8 lg:grid-cols-2 lg:items-center lg:pt-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-mw-bright/40 bg-mw-bright/15 px-4 py-2 text-sm font-bold text-mw-mint">
              <span className="size-2 animate-pulse rounded-full bg-mw-bright" /> صوتي • منتج ذكاء اصطناعي من مسور
            </span>
            <h1 className="mt-7 font-kufi text-4xl font-black leading-[1.45] text-primary-foreground md:text-6xl">
              موظف ذكي يرد على عملائك <span className="mw-text-grad">بالصوت والواتساب</span> ويؤتمت الباقي
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-9 text-mw-mint/85 md:text-xl">
              مكالمات تُجاب، رسائل تُرد، ومواعيد تُذكَّر تلقائياً — منصة واحدة تشتغل عنك 24 ساعة وتقلل الحجوزات الضائعة.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/" hash="demo" className="mw-grad inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-lg font-bold text-mw-night">اسمع مكالمة تجريبية <ArrowLeft className="size-5" /></Link>
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-2xl border border-primary-foreground/30 bg-primary-foreground/10 px-7 py-4 text-lg font-bold text-primary-foreground hover:bg-primary-foreground/15">احجز عرضاً مخصصاً</Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-8">
              {[["24/7", "استقبال دائم"], ["3 قنوات", "صوت • واتساب • أتمتة"], ["-40%", "تغيب أقل متوقع"]].map(([n, l]) => (
                <div key={l}><div className="font-kufi text-3xl font-extrabold text-primary-foreground">{n}</div><div className="text-sm text-mw-mint/75">{l}</div></div>
              ))}
            </div>
          </div>

          <div className="relative">
            <img src={heroImg} alt="مكتب استقبال بإضاءة خضراء وهاتف يستقبل مكالمة ورسالة واتساب" width={1280} height={960} className="h-[520px] w-full rounded-3xl border border-mw-bright/20 object-cover" />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-mw-night via-mw-night/40 to-transparent" />
            <div className="absolute inset-x-5 bottom-8 space-y-3 md:inset-x-8">
              <Bubble icon={Phone} label="مكالمة واردة • 10:42 ص" text="أبغى أحجز موعد مع دكتور الأسنان يوم الأحد" />
              <Bubble icon={Sparkles} label="وكيل صوتي" text="أبشر، متاح الأحد 4:30 العصر. أثبته باسمك؟" accent />
              <Bubble icon={MessageCircle} label="واتساب • تلقائي" text="تم تأكيد موعدك الأحد 4:30م ✅ الموقع: خرائط جوجل" />
            </div>
            <div className="absolute -top-4 left-6 flex items-center gap-2 rounded-full border border-mw-bright/50 bg-mw-night px-4 py-2 text-sm font-bold text-mw-bright">
              <CheckCircle2 className="size-4" /> موعد مؤكد بدون موظف
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-hidden border-y border-mw-bright/15 bg-mw-night py-5" dir="ltr">
        <div className="mw-marquee flex w-max gap-10 whitespace-nowrap font-kufi text-3xl font-extrabold">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-10">
              {["وكيل صوتي", "واتساب ذكي", "أتمتة", "حجز مواعيد", "تذكيرات", "قاعدة معرفة"].map((w, i) => (
                <span key={w} className="flex items-center gap-10"><span className={i % 2 ? "text-mw-mint/40" : "text-mw-bright"}>{w}</span><span className="text-mw-gold">✦</span></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-24 md:px-8">
        <SecHead tag="منصة واحدة • ثلاث قوى" title="ليس مجرد رد على المكالمات" sub="صوتي يجمع المكالمات وواتساب والأتمتة في وكيل واحد يعرف نشاطك وقاعدة معرفتك." />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <article key={p.title} className="group relative overflow-hidden rounded-3xl border border-mw-line bg-card p-8 transition hover:-translate-y-2 hover:shadow-xl">
              <div className="mw-grad flex size-14 items-center justify-center rounded-2xl text-primary-foreground"><p.icon className="size-7" /></div>
              <h3 className="mt-6 font-kufi text-2xl font-extrabold">{p.title}</h3>
              <p className="mt-3 leading-8 text-mw-muted">{p.desc}</p>
              <ul className="mt-6 space-y-2">
                {p.points.map((x) => <li key={x} className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5 text-mw-brand" />{x}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-card py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SecHead tag="كيف تتكامل القنوات" title="رحلة عميل كاملة… تلقائياً" sub="من أول مكالمة إلى حضور الموعد، كل خطوة تتم بدون تدخل يدوي." />
          <div className="mt-14 grid gap-6 md:grid-cols-4">
            {flow.map((f, i) => (
              <div key={f.t} className="rounded-3xl border border-mw-line bg-mw-bg p-7 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-mw-night font-kufi text-xl font-black text-mw-bright">{i + 1}</div>
                <f.icon className="mx-auto mt-5 size-7 text-mw-brand" />
                <h4 className="mt-3 font-kufi text-lg font-extrabold">{f.t}</h4>
                <p className="mt-2 text-sm leading-7 text-mw-muted">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-24 md:grid-cols-2 md:px-8">
        <figure className="relative overflow-hidden rounded-3xl">
          <img src={waImg} alt="صاحب منشأة يتابع ردود واتساب الآلية من جواله" width={1024} height={1024} loading="lazy" className="h-[420px] w-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-mw-night to-transparent p-6 font-kufi text-xl font-extrabold text-primary-foreground">عملاؤك يُخدمون على واتساب… وأنت مرتاح</figcaption>
        </figure>
        <figure className="relative overflow-hidden rounded-3xl">
          <img src={autoImg} alt="موجة صوتية تتحول إلى رسائل ومواعيد مؤتمتة" width={1280} height={800} loading="lazy" className="h-[420px] w-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-mw-night to-transparent p-6 font-kufi text-xl font-extrabold text-primary-foreground">من مكالمة إلى موعد مؤكد… تلقائياً</figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 md:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[[ShieldCheck, "متوافق مع PDPL", "فصل بيانات كل منشأة وتنبيه تسجيل المكالمات"], [BarChart3, "لوحة نتائج واضحة", "الحضور، الحجوزات، أوقات الذروة"], [Users, "تحويل ذكي للموظف", "الحالات الحساسة تصل لفريقك فوراً"], [Clock, "تشغيل خلال أيام", "إعداد قاعدة المعرفة والوكيل معك"]].map(([I, t, d]) => {
            const Icon = I as typeof ShieldCheck;
            return (
              <div key={t as string} className="rounded-3xl border border-mw-line bg-card p-6">
                <Icon className="size-8 text-mw-brand" />
                <h4 className="mt-4 font-kufi text-lg font-extrabold">{t as string}</h4>
                <p className="mt-2 text-sm leading-7 text-mw-muted">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 md:px-8">
        <div className="mw-gridbg relative overflow-hidden rounded-[2rem] bg-mw-night px-8 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-mw-bright/10 blur-2xl" />
          <h2 className="relative font-kufi text-3xl font-black text-primary-foreground md:text-5xl">خلّ <span className="mw-text-grad">صوتي</span> يشتغل عنك من اليوم</h2>
          <p className="relative mx-auto mt-5 max-w-2xl text-lg text-mw-mint/85">مكالمات + واتساب + أتمتة، بخبرة فريق مسور في التنفيذ.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" className="mw-grad rounded-2xl px-8 py-4 text-lg font-bold text-mw-night">ابدأ التجربة</Link>
            <Link to="/contact" className="rounded-2xl border border-mw-bright/40 px-8 py-4 text-lg font-bold text-primary-foreground">تواصل مع مسور</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-mw-line py-8 text-center text-sm text-mw-muted">
        صوتي — منتج من <a href="https://meswar.com/" target="_blank" rel="noreferrer" className="font-bold text-mw-brand">مسور</a> • meswar2030@gmail.com
      </footer>
    </div>
  );
}

function SecHead({ tag, title, sub }: { tag: string; title: string; sub: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="font-extrabold text-mw-brand">{tag}</span>
      <h2 className="mt-3 font-kufi text-3xl font-black md:text-4xl">{title}</h2>
      <p className="mt-4 text-lg leading-8 text-mw-muted">{sub}</p>
    </div>
  );
}

function Bubble({ icon: Icon, label, text, accent }: { icon: typeof Phone; label: string; text: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-mw-bright/40 bg-mw-bright/15" : "border-primary-foreground/10 bg-primary-foreground/5"}`}>
      <div className="flex items-center gap-2 text-xs font-bold text-mw-mint/80"><Icon className="size-4" />{label}</div>
      <p className="mt-2 font-semibold leading-7 text-primary-foreground">{text}</p>
    </div>
  );
}
