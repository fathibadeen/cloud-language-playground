import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  Headphones,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";
import { usePlans } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import heroImage from "@/assets/saudi-ai-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "صوتي | تواصل سعودي ذكي يخدم عملاءك 24/7" },
      { name: "description", content: "صوتي للمكالمات وواتساب، مصمم للشركات السعودية ويتواصل مع العملاء بالعربية والإنجليزية على مدار الساعة." },
      { property: "og:title", content: "صوتي | تواصل سعودي ذكي يخدم عملاءك 24/7" },
      { property: "og:description", content: "تواصل ذكي للمكالمات وواتساب، بصوت طبيعي وإدارة مركزية." },
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
  const ar = locale === "ar";
  const copy = ar
    ? {
        badge: "تقنية سعودية تفهم عميلك",
        title: "صوتك حاضر",
        titleAccent: "وعملاؤك مسموعون",
        intro: "خلّ التواصل علينا. صوتي يدير المكالمات وواتساب، يفهم سياق عملك ويتعامل مع عملائك باحتراف على مدار الساعة.",
        try: "ابدأ تجربتك",
        discover: "شوف وش يقدر يسوي",
        stat1: "خدمة متواصلة",
        stat2: "عربي وإنجليزي",
        stat3: "صوت وواتساب",
        trusted: "مصمم لطريقة عمل الشركات السعودية",
        servicesTitle: "كل تواصل مع عميلك.. محسوب",
        servicesSub: "من أول «ألو» إلى إغلاق الطلب، صوتي يحافظ على أسلوب شركتك ويعطيك الصورة كاملة.",
        howTitle: "تشغيله أبسط مما تتوقع",
        pricingTitle: "اختر المساحة المناسبة لنموك",
        pricingSub: "الخطط معروضة للمقارنة، والدفع الإلكتروني غير مفعّل حاليًا.",
        closing: "جاهز تخلي خدمة عملائك دايم حاضرة؟",
        closingSub: "سجّل بيانات شركتك، جهّز أسلوب التواصل، وخلك قريب من كل محادثة من لوحة واحدة.",
      }
    : {
        badge: "Saudi technology that understands your customers",
        title: "Your voice, always present",
        titleAccent: "your customers, always heard",
        intro: "Let Sawti handle every response across calls and WhatsApp, grounded in your business context and available around the clock.",
        try: "Start your experience",
        discover: "See what it can do",
        stat1: "Always available",
        stat2: "Arabic & English",
        stat3: "Voice & WhatsApp",
        trusted: "Built for how Saudi businesses work",
        servicesTitle: "Every customer interaction, accounted for",
        servicesSub: "From the first hello to resolution, Sawti keeps your brand voice consistent and your team informed.",
        howTitle: "Remarkably simple to launch",
        pricingTitle: "Choose room to grow",
        pricingSub: "Plans are shown for comparison. Online payment is currently disabled.",
        closing: "Ready to keep customer service always on?",
        closingSub: "Add your company, prepare your agent, and stay close to every conversation from one place.",
      };

  const services = [
    { icon: Phone, title: ar ? "رد صوتي طبيعي" : "Natural voice", text: ar ? "يستقبل المكالمات، يفهم الطلب، ويحوّل لموظفك وقت الحاجة." : "Answers calls, understands intent, and hands off when needed." },
    { icon: MessageSquare, title: ar ? "واتساب بلا انتظار" : "WhatsApp without waiting", text: ar ? "يرد على الأسئلة المتكررة ويتابع المحادثات بنفس أسلوب علامتك." : "Handles common questions in your brand's tone." },
    { icon: BookOpen, title: ar ? "يعرف شغلك زين" : "Knows your business", text: ar ? "يتعلم من خدماتك وسياساتك وملفاتك، عشان تكون إجابته في محلها." : "Learns from your services, policies, and documents." },
    { icon: BarChart3, title: ar ? "الصورة عندك واضحة" : "Clarity at a glance", text: ar ? "مكالمات ومحادثات واستخدام وفريقك؛ كلها في لوحة مرتبة." : "Calls, conversations, usage, and team activity in one view." },
  ];

  return (
    <div className="min-h-screen bg-landing text-landing-foreground">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-landing-foreground/10 bg-landing/80 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg border border-gold/50 bg-saudi font-display text-xl font-bold text-saudi-bright">ص</span>
            <div><div className="font-display text-xl font-bold">صوتي</div><div className="text-sm text-landing-muted">Sawti</div></div>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-landing-muted lg:flex">
            <a href="#services" className="transition-colors hover:text-landing-foreground">{t("features")}</a>
            <a href="#how" className="transition-colors hover:text-landing-foreground">{t("howItWorks")}</a>
            <a href="#pricing" className="transition-colors hover:text-landing-foreground">{t("pricing")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button asChild variant="ghost" size="sm" className="hidden text-landing-foreground hover:bg-landing-foreground/10 hover:text-landing-foreground sm:inline-flex">
              <Link to={user ? "/dashboard" : "/auth"}>{user ? t("navHome") : t("login")}</Link>
            </Button>
            {!user ? <Button asChild size="sm" className="bg-saudi-bright text-primary-foreground hover:bg-saudi-bright/90"><Link to="/auth" search={{ mode: "signup" }}>{copy.try}</Link></Button> : null}
          </div>
        </div>
      </header>

      <main>
        <section className="relative flex min-h-[760px] items-end overflow-hidden pt-24 md:min-h-[820px] md:items-center">
          <img src={heroImage} alt={ar ? "رائد أعمال سعودي يستخدم منصة صوتي" : "Saudi business leader using Sawti"} width={1536} height={1024} className="absolute inset-0 size-full object-cover object-[62%_center] opacity-90" />
          <div className="absolute inset-0 bg-linear-to-t from-landing via-landing/75 to-landing/10 md:bg-linear-to-r md:from-landing md:via-landing/80 md:to-landing/5" />
          <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 md:px-8 md:pb-12">
            <div className="max-w-3xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-saudi-bright/40 bg-saudi/40 px-4 py-2 text-sm text-saudi-bright backdrop-blur">
                <span className="size-2 rounded-full bg-saudi-bright shadow-[0_0_16px_var(--saudi-bright)]" />{copy.badge}
              </div>
              <h1 className="font-display text-5xl font-bold leading-[1.16] md:text-7xl">{copy.title}<span className="mt-2 block text-gold">{copy.titleAccent}</span></h1>
              <p className="mt-6 max-w-2xl text-xl font-medium leading-9 text-landing-muted md:text-2xl md:leading-10">{copy.intro}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-saudi-bright text-primary-foreground hover:bg-saudi-bright/90"><Link to="/auth" search={{ mode: "signup" }}>{copy.try}<ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="border-landing-foreground/20 bg-landing-foreground/5 text-landing-foreground backdrop-blur hover:bg-landing-foreground/10 hover:text-landing-foreground"><a href="#services">{copy.discover}</a></Button>
              </div>
              <div className="mt-12 grid max-w-2xl grid-cols-3 border-t border-landing-foreground/10 pt-7">
                {[['24/7', copy.stat1], ['AR / EN', copy.stat2], ['2×', copy.stat3]].map(([value, label]) => <div key={label} className="border-e border-landing-foreground/10 px-4 first:px-s-0 last:border-0"><div className="font-display text-2xl font-semibold text-landing-foreground">{value}</div><div className="mt-1 text-sm text-landing-muted md:text-base">{label}</div></div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-landing-foreground/10 bg-saudi/55 py-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-4 text-base text-landing-muted md:justify-between md:px-8"><span className="flex items-center gap-2 font-semibold text-landing-foreground"><Sparkles className="size-5 text-gold" />{copy.trusted}</span><span>رؤية أوضح</span><span>استجابة أسرع</span><span>تجربة أهدى لفريقك</span></div></section>

        <section id="services" className="py-24"><div className="mx-auto max-w-7xl px-4 md:px-8"><div className="max-w-3xl"><span className="text-base font-semibold text-gold">{ar ? "وش نقدّم لك" : "WHAT YOU GET"}</span><h2 className="mt-4 font-display text-3xl font-bold md:text-5xl">{copy.servicesTitle}</h2><p className="mt-5 text-xl leading-9 text-landing-muted">{copy.servicesSub}</p></div><div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-landing-foreground/10 bg-landing-foreground/10 md:grid-cols-2">{services.map((service) => <div key={service.title} className="bg-landing p-7 transition-colors hover:bg-saudi/45 md:p-9"><service.icon className="size-8 text-saudi-bright" /><h3 className="mt-7 text-2xl font-semibold">{service.title}</h3><p className="mt-3 max-w-md text-lg leading-8 text-landing-muted">{service.text}</p></div>)}</div></div></section>

        <section id="how" className="border-y border-landing-foreground/10 bg-saudi/30 py-24"><div className="mx-auto max-w-7xl px-4 md:px-8"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><span className="text-base font-semibold text-gold">{ar ? "من التسجيل للتشغيل" : "FROM SIGNUP TO LIVE"}</span><h2 className="mt-4 font-display text-3xl font-bold md:text-5xl">{copy.howTitle}</h2></div><p className="max-w-md text-lg leading-8 text-landing-muted">{ar ? "لا لف ولا دوران: عرّفنا على نشاطك، جهّز المعرفة، وصوتي يصير جاهزًا للاستقبال." : "Introduce your business, add its knowledge, and Sawti is ready to serve."}</p></div><div className="mt-14 grid gap-8 md:grid-cols-4">{[[Users, '01', ar ? 'عرّفنا بشركتك' : 'Add your company'], [BookOpen, '02', ar ? 'حمّل معلوماتك' : 'Share your knowledge'], [Headphones, '03', ar ? 'اضبط أسلوب الرد' : 'Shape the response'], [ShieldCheck, '04', ar ? 'تابع كل شيء' : 'Stay in control']].map(([Icon, n, label]) => { const StepIcon = Icon as typeof Users; return <div key={String(n)} className="border-t border-landing-foreground/15 pt-5"><div className="flex items-center justify-between"><StepIcon className="size-6 text-saudi-bright" /><span className="font-display text-base text-gold">{String(n)}</span></div><h3 className="mt-8 text-xl font-semibold">{String(label)}</h3></div>; })}</div></div></section>

        <section id="pricing" className="py-24"><div className="mx-auto max-w-7xl px-4 md:px-8"><div className="text-center"><h2 className="font-display text-3xl font-bold md:text-5xl">{copy.pricingTitle}</h2><p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-landing-muted">{copy.pricingSub}</p></div><div className="mt-14 grid gap-5 md:grid-cols-3">{(plans ?? []).map((plan, index) => <div key={plan.id} className={`rounded-lg border p-7 ${index === 1 ? 'border-gold bg-saudi/45' : 'border-landing-foreground/10 bg-landing-foreground/[0.03]'}`}><div className="flex items-center justify-between"><h3 className="text-2xl font-semibold">{ar ? plan.name_ar : plan.name_en}</h3>{index === 1 ? <span className="rounded-full bg-gold px-3 py-1 text-sm font-semibold text-gold-foreground">{ar ? 'الأكثر طلبًا' : 'Popular'}</span> : null}</div><p className="mt-7 font-display text-4xl font-bold">{Number(plan.price_sar).toFixed(0)} <span className="font-sans text-base font-normal text-landing-muted">{t('perMonth')}</span></p><ul className="mt-7 space-y-3 text-base text-landing-muted">{[[plan.voice_minutes, t('voiceMinutes')], [plan.whatsapp_messages, t('whatsappMessages')], [plan.max_agents, t('navAgents')]].map(([value, label]) => <li key={String(label)} className="flex items-center gap-2"><Check className="size-5 text-saudi-bright" />{value} {label}</li>)}</ul><Button asChild className="mt-8 w-full" variant={index === 1 ? 'default' : 'outline'}><Link to="/auth" search={{ mode: 'signup' }}>{copy.try}</Link></Button></div>)}</div></div></section>

        <section className="border-t border-landing-foreground/10 bg-saudi py-20"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 md:flex-row md:items-center md:px-8"><div><h2 className="font-display text-3xl font-bold md:text-4xl">{copy.closing}</h2><p className="mt-3 max-w-2xl text-lg leading-8 text-landing-muted">{copy.closingSub}</p></div><Button asChild size="lg" className="shrink-0 bg-gold text-gold-foreground hover:bg-gold/90"><Link to="/auth" search={{ mode: 'signup' }}>{copy.try}<ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" /></Link></Button></div></section>
      </main>
      <footer className="border-t border-landing-foreground/10 py-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 text-base text-landing-muted md:flex-row md:px-8"><span className="font-display text-lg font-semibold text-landing-foreground">صوتي — Sawti</span><span>{ar ? "تقنية تخدم الناس.. مثل ما ينبغي" : "Technology that serves people properly"}</span><span>© {new Date().getFullYear()}</span></div></footer>
    </div>
  );
}