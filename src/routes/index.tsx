import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { addonPrice, CLINIC_SETUP_FEE_SAR, periodPrice, plansFor, productFeatures, productLabels, type BillingPeriod, type PlanRow, type Product } from "@/lib/products";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  ExternalLink,
  Headphones,
  MessageSquare,
  Menu,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SawtiLogo } from "@/components/SawtiLogo";
import { HeroVoiceCard } from "@/components/HeroVoiceCard";
import { IndustrySolutions } from "@/components/IndustrySolutions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { usePlans } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import heroImage from "@/assets/saudi-ai-hero.jpg";
import socialImage from "@/assets/sawti-social-share.jpg";
import meswarLogo from "@/assets/brand/meswar-logo.jpg.asset.json";
import aiConsultingLogo from "@/assets/brand/ai-consulting-logo.jpg.asset.json";

const siteUrl = "https://www.sawti-ai.com";
const socialImageUrl = `${siteUrl}/sawti-social-share.jpg`;
const voiceDemoUrl = "https://app.nabrah.ai/call/wgt_S0L-5WWKeyrqTJmU2_vsyJd4";
const faqAr = [
  ["ما هي منصة صوتي؟", "صوتي منصة تواصل ذكية للشركات تدير المكالمات ومحادثات واتساب، وتجيب العملاء اعتمادًا على معلومات شركتك."],
  ["هل تدعم العربية والإنجليزية؟", "نعم، يستطيع وكلاء صوتي التواصل بالعربية والإنجليزية بما يناسب عملاء شركتك."],
  ["كيف يتعلم الوكيل معلومات الشركة؟", "تضيف ملفاتك وسياساتك وروابطك وأسئلتك الشائعة إلى قاعدة معرفة شركتك، ويستخدمها الوكيل لتقديم إجابات مرتبطة بنشاطك."],
  ["هل تعمل المنصة مع المكالمات وواتساب؟", "نعم، تدعم صوتي الوكيل الصوتي ومحادثات واتساب ضمن لوحة تحكم موحدة، بعد ربط كل قناة وتفعيلها."],
  ["متى يتحول التواصل إلى موظف؟", "يمكن للوكيل إحالة المحادثة أو المكالمة إلى فريقك عندما يحتاج العميل تدخلًا بشريًا أو حسب القواعد التي تضبطها."],
  ["هل بيانات كل شركة منفصلة وآمنة؟", "نعم، ترتبط البيانات بحساب الشركة وتُطبق صلاحيات تمنع مستخدمي الشركات الأخرى من الوصول إليها."],
  ["كم يستغرق الإعداد؟", "يمكن إنشاء الشركة وإضافة المعرفة وتجهيز الوكيل خلال دقائق، بينما يعتمد تفعيل أرقام الاتصال وواتساب على اكتمال ربط المزود ومراجعته."],
  ["هل أحتاج خبرة تقنية؟", "لا. صُممت خطوات الإعداد والإدارة لتكون واضحة، ويمكن لفريق صوتي مساعدتك في ربط القنوات التي تتطلب موافقات خارجية."],
  ["هل يمكنني متابعة المكالمات والمحادثات؟", "نعم، تعرض لوحة التحكم السجلات والمحادثات وحالة التحويل للموظف والاستخدام المتاح لشركتك."],
  ["كيف تعمل التجربة والخطط حاليًا؟", "تظهر الخطط للمقارنة وتعمل الحسابات بفترة تجريبية. الدفع الإلكتروني غير مفعّل حاليًا، لذلك لن تُخصم أي رسوم إلكترونية."],
] as const;

const faqEn = [
  ["What is Sawti?", "Sawti is an intelligent communications platform for businesses that handles calls and WhatsApp conversations using your company knowledge."],
  ["Does Sawti support Arabic and English?", "Yes. Sawti agents can communicate in Arabic and English to match your customers."],
  ["How does the agent learn about my company?", "Add files, policies, links, and FAQs to your company knowledge base. The agent uses them to answer in your business context."],
  ["Does it work with calls and WhatsApp?", "Yes. Sawti supports voice agents and WhatsApp conversations in one dashboard once each channel is connected and activated."],
  ["When is a conversation handed to a person?", "The agent can hand a call or conversation to your team when human help is needed or according to rules you configure."],
  ["Is each company's data separate and secure?", "Yes. Data is tied to its company account, with access controls that prevent users from other companies from viewing it."],
  ["How long does setup take?", "You can create your company, add knowledge, and prepare an agent in minutes. Phone and WhatsApp activation depends on provider connection and approval."],
  ["Do I need technical experience?", "No. Setup and management are designed to be clear, and the Sawti team can help with channels that require external approval."],
  ["Can I review calls and conversations?", "Yes. The dashboard shows records, conversations, human handoff status, and your company's usage."],
  ["How do the trial and plans work today?", "Plans are displayed for comparison and accounts run on a trial. Online payments are currently disabled, so no online charge is made."],
] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "صوتي | تواصل سعودي ذكي يخدم عملاءك 24/7" },
      { name: "description", content: "صوتي للمكالمات وواتساب، مصمم للشركات السعودية ويتواصل مع العملاء بالعربية والإنجليزية على مدار الساعة." },
      { property: "og:title", content: "صوتي | تواصل سعودي ذكي يخدم عملاءك 24/7" },
      { property: "og:description", content: "تواصل ذكي للمكالمات وواتساب، بصوت طبيعي وإدارة مركزية." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl },
      { property: "og:image", content: socialImageUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "صوتي | تواصل سعودي ذكي يخدم عملاءك 24/7" },
      { name: "twitter:description", content: "تواصل ذكي للمكالمات وواتساب، بصوت طبيعي وإدارة مركزية." },
      { name: "twitter:image", content: socialImageUrl },
    ],
    links: [{ rel: "canonical", href: siteUrl }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", name: "صوتي", alternateName: "Sawti", url: siteUrl, email: "meswar2030@gmail.com" },
            { "@type": "WebSite", name: "صوتي", alternateName: "Sawti", url: siteUrl, inLanguage: ["ar", "en"] },
            { "@type": "FAQPage", mainEntity: faqAr.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
          ],
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { data: plans } = usePlans();
  const [product, setProduct] = useState<Product>("whatsapp");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [voiceDemoOpen, setVoiceDemoOpen] = useState(false);
  const [voiceDemoLoaded, setVoiceDemoLoaded] = useState(false);
  const ar = locale === "ar";
  const copy = ar
    ? {
        badge: "تقنية سعودية تفهم عميلك",
        title: "صوتك حاضر",
        titleAccent: "وعملاؤك مسموعون",
        intro: "خلّ التواصل علينا. صوتي يدير المكالمات وواتساب، يفهم سياق عملك ويتعامل مع عملائك باحتراف على مدار الساعة.",
        try: "ابدأ تجربتك",
        discover: "شوف وش يقدر يسوي",
        voiceDemo: "جرّب مكالمة صوتية",
        stat1: "خدمة متواصلة",
        stat2: "عربي وإنجليزي",
        stat3: "صوت وواتساب",
        trusted: "مصمم لطريقة عمل الشركات السعودية",
        partnersTitle: "شركاء المنصة",
        partnersSub: "صوتي منتج من مسور، وبشراكة معرفية مع جهات متخصصة في حلول الذكاء.",
        servicesTitle: "كل تواصل مع عميلك.. محسوب",
        servicesSub: "من أول «ألو» إلى إغلاق الطلب، صوتي يحافظ على أسلوب شركتك ويعطيك الصورة كاملة.",
        howTitle: "تشغيله أبسط مما تتوقع",
        pricingTitle: "اختر المساحة المناسبة لنموك",
        pricingSub: "ادفع شهريًا أو وفّر شهرين مع الاشتراك السنوي. الأسعار قبل ضريبة القيمة المضافة 15%.",
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
        voiceDemo: "Try a voice call",
        stat1: "Always available",
        stat2: "Arabic & English",
        stat3: "Voice & WhatsApp",
        trusted: "Built for how Saudi businesses work",
        partnersTitle: "Platform partners",
        partnersSub: "Sawti is a Meswar product, supported by specialized partners in intelligent solutions.",
        servicesTitle: "Every customer interaction, accounted for",
        servicesSub: "From the first hello to resolution, Sawti keeps your brand voice consistent and your team informed.",
        howTitle: "Remarkably simple to launch",
        pricingTitle: "Choose room to grow",
        pricingSub: "Pay monthly, or get two months free with yearly billing. Prices exclude 15% VAT.",
        closing: "Ready to keep customer service always on?",
        closingSub: "Add your company, prepare your agent, and stay close to every conversation from one place.",
      };

  const services = [
    { icon: Phone, title: ar ? "رد صوتي طبيعي" : "Natural voice", text: ar ? "يستقبل المكالمات، يفهم الطلب، ويحوّل لفريقك وقت الحاجة." : "Answers calls, understands intent, and hands off when needed." },
    { icon: MessageSquare, title: ar ? "واتساب بلا انتظار" : "WhatsApp without waiting", text: ar ? "يرد على الأسئلة المتكررة ويتابع المحادثات بنفس أسلوب علامتك." : "Handles common questions in your brand's tone." },
    { icon: BookOpen, title: ar ? "يعرف شغلك زين" : "Knows your business", text: ar ? "يتعلم من خدماتك وسياساتك وملفاتك، عشان تكون إجابته في محلها." : "Learns from your services, policies, and documents." },
    { icon: BarChart3, title: ar ? "الصورة عندك واضحة" : "Clarity at a glance", text: ar ? "مكالمات ومحادثات واستخدام وفريقك؛ كلها في لوحة مرتبة." : "Calls, conversations, usage, and team activity in one view." },
  ];
  const faqs = ar ? faqAr : faqEn;

  const openDemo = () => { setVoiceDemoLoaded(false); setVoiceDemoOpen(true); };
  const pillars = [
    { icon: Phone, title: ar ? "وكيل المكالمات" : "Voice agent", desc: ar ? "يرد على كل مكالمة 24/7 بلهجة سعودية طبيعية، يجيب الأسئلة ويحجز المواعيد ويحوّل للموظف عند الحاجة." : "Answers every call 24/7 in natural Saudi Arabic, books appointments and hands off when needed.", points: ar ? ["لا مكالمة فائتة", "حجز وتعديل وإلغاء", "تنبيه تسجيل المكالمة"] : ["No missed calls", "Book, change, cancel", "Recording notice"] },
    { icon: MessageSquare, title: ar ? "وكيل واتساب" : "WhatsApp agent", desc: ar ? "يستقبل الاستفسارات ويرد فوراً من قاعدة معرفتك، ويرسل الموقع والتعليمات والتأكيدات داخل المحادثة." : "Replies instantly from your knowledge base and sends location, instructions and confirmations.", points: ar ? ["رد فوري بالعربي", "حجز من المحادثة", "ربط رسمي مع Meta"] : ["Instant Arabic replies", "Book in chat", "Official Meta link"] },
    { icon: Workflow, title: ar ? "الأتمتة الذكية" : "Smart automation", desc: ar ? "تذكيرات تلقائية، متابعة بعد الزيارة، استرجاع المتغيبين، وتنبيهات فورية لفريقك — بدون تدخل يدوي." : "Automatic reminders, follow-ups, no-show recovery and team alerts — no manual work.", points: ar ? ["تذكير قبل 24 ساعة وساعتين", "متابعة المتغيبين", "مزامنة التقويم"] : ["24h & 2h reminders", "No-show follow-up", "Calendar sync"] },
  ];
  const flow = [
    { icon: Phone, t: ar ? "العميل يتصل" : "Customer calls", d: ar ? "الوكيل يرد ويفهم الطلب ويحجز موعداً" : "The agent answers and books" },
    { icon: MessageSquare, t: ar ? "تأكيد على واتساب" : "WhatsApp confirmation", d: ar ? "رسالة تأكيد فورية مع الموقع والتعليمات" : "Instant confirmation with location" },
    { icon: BellRing, t: ar ? "تذكير تلقائي" : "Auto reminder", d: ar ? "قبل الموعد بـ24 ساعة وساعتين" : "24h and 2h before" },
    { icon: CalendarCheck, t: ar ? "حضور ومتابعة" : "Visit & follow-up", d: ar ? "متابعة بعد الزيارة أو موعد بديل للمتغيب" : "Follow-up or a new slot for no-shows" },
  ];

  return (
    <div className="theme-meswar min-h-screen bg-landing text-landing-foreground">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-mw-bright/15 bg-mw-night/85 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link to="/" aria-label={ar ? "صوتي — الرئيسية" : "Sawti — Home"} className="rounded-xl bg-primary-foreground/95 px-3 py-1.5"><SawtiLogo compact /></Link>
          <nav className="hidden items-center gap-7 text-base font-semibold text-mw-mint/85 lg:flex">
            <a href="#services" className="hover:text-primary-foreground">{t("features")}</a>
            <a href="#how" className="hover:text-primary-foreground">{t("howItWorks")}</a>
            <a href="#pricing" className="hover:text-primary-foreground">{t("pricing")}</a>
            <a href="#faq" className="hover:text-primary-foreground">{t("faq")}</a>
          </nav>
          <div className="flex items-center gap-2 text-primary-foreground">
            <LanguageToggle />
            <Button asChild variant="ghost" size="sm" className="hidden text-mw-mint hover:bg-mw-mint/10 hover:text-primary-foreground sm:inline-flex">
              <Link to={user ? "/dashboard" : "/auth"}>{user ? t("navHome") : t("login")}</Link>
            </Button>
            {!user ? <Button asChild size="sm" className="bg-mw-bright font-bold text-mw-night hover:bg-mw-bright/90"><Link to="/auth" search={{ mode: "signup" }}>{copy.try}</Link></Button> : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-mw-mint hover:bg-mw-mint/10 lg:hidden" aria-label={ar ? "فتح القائمة" : "Open menu"}><Menu /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild><a href="#services" className="py-3 text-lg font-medium">{t("features")}</a></DropdownMenuItem>
                <DropdownMenuItem asChild><a href="#how" className="py-3 text-lg font-medium">{t("howItWorks")}</a></DropdownMenuItem>
                <DropdownMenuItem asChild><a href="#pricing" className="py-3 text-lg font-medium">{t("pricing")}</a></DropdownMenuItem>
                <DropdownMenuItem asChild><a href="#faq" className="py-3 text-lg font-medium">{t("faq")}</a></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/contact" className="py-3 text-lg font-medium">{t("contact")}</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main>
        <section className="mw-gridbg relative overflow-hidden bg-mw-night pt-24">
          <div className="pointer-events-none absolute -top-40 right-[-10%] size-[520px] rounded-full bg-mw-bright/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-30%] left-[-10%] size-[480px] rounded-full bg-mw-gold/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-10 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-mw-bright/40 bg-mw-bright/15 px-4 py-2 text-sm font-bold text-mw-mint">
                <span className="size-2 animate-pulse rounded-full bg-mw-bright" /> {ar ? "صوتي • منتج ذكاء اصطناعي من مسور" : "Sawti • An AI product by Meswar"}
              </span>
              <h1 className="mt-7 font-kufi text-4xl font-black leading-[1.45] text-primary-foreground md:text-6xl">
                {ar ? <>موظف ذكي يرد على عملائك <span className="mw-text-grad">بالصوت والواتساب</span> ويؤتمت الباقي</> : <>An AI employee that answers by <span className="mw-text-grad">voice and WhatsApp</span> and automates the rest</>}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-9 text-mw-mint/85 md:text-xl">
                {ar ? "مكالمات تُجاب، رسائل تُرد، ومواعيد تُذكَّر تلقائياً — منصة واحدة تشتغل عنك 24 ساعة وتقلل الحجوزات الضائعة." : "Calls answered, messages replied, appointments reminded — one platform working for you 24/7."}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <button type="button" onClick={openDemo} className="mw-grad inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-lg font-bold text-mw-night"><Volume2 className="size-5" />{ar ? "اسمع مكالمة تجريبية" : "Hear a demo call"}</button>
                <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-2 rounded-2xl border border-primary-foreground/30 bg-primary-foreground/10 px-7 py-4 text-lg font-bold text-primary-foreground hover:bg-primary-foreground/15">{copy.try}<ArrowLeft className="size-5 ltr:rotate-180" /></Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-8">
                {[["24/7", ar ? "استقبال دائم" : "Always on"], [ar ? "3 قنوات" : "3 channels", ar ? "صوت • واتساب • أتمتة" : "Voice • WhatsApp • Automation"], ["AR / EN", ar ? "عربي وإنجليزي" : "Arabic & English"]].map(([n, l]) => (
                  <div key={l}><div className="font-kufi text-3xl font-extrabold text-primary-foreground">{n}</div><div className="text-sm text-mw-mint/75">{l}</div></div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <HeroVoiceCard ar={ar} onCall={openDemo} />
            </div>
          </div>
        </section>

         <Dialog open={voiceDemoOpen} onOpenChange={setVoiceDemoOpen}>
            <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-4 sm:p-6" dir={ar ? "rtl" : "ltr"}>
             <DialogHeader className="pe-8 text-start">
               <DialogTitle className="text-2xl">{ar ? "تحدّث مع وكيل صوتي الآن" : "Talk to a voice agent now"}</DialogTitle>
               <DialogDescription className="text-base leading-7">
                 {ar ? "اسمح للمتصفح باستخدام الميكروفون، ثم ابدأ الحديث مع الوكيل التجريبي." : "Allow microphone access, then start talking with the demo agent."}
               </DialogDescription>
             </DialogHeader>
             <div className="relative min-h-[520px] overflow-hidden rounded-lg border bg-muted/40">
               {!voiceDemoLoaded ? <div className="absolute inset-0 grid place-items-center text-base font-medium text-muted-foreground">{ar ? "جارٍ تجهيز المكالمة…" : "Preparing your call…"}</div> : null}
               <iframe title={ar ? "مكالمة مع وكيل صوتي تجريبي" : "Demo voice agent call"} src={voiceDemoUrl} allow="microphone; autoplay" onLoad={() => setVoiceDemoLoaded(true)} className="relative h-[65vh] min-h-[520px] w-full border-0" />
             </div>
             <Button asChild variant="outline" className="w-full sm:w-auto">
               <a href={voiceDemoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{ar ? "فتح التجربة في نافذة جديدة" : "Open the demo in a new window"}</a>
             </Button>
             <Button asChild className="w-full sm:w-auto"><Link to="/contact">{ar ? "اطلب عرضاً مخصصاً لمنشأتك" : "Request a tailored offer"}</Link></Button>
           </DialogContent>
         </Dialog>

        <div className="overflow-hidden border-y border-mw-bright/15 bg-mw-night py-5" dir="ltr">
          <div className="mw-marquee flex w-max gap-10 whitespace-nowrap font-kufi text-3xl font-extrabold">
            {[0, 1].map((k) => (
              <div key={k} className="flex gap-10">
                {(ar ? ["وكيل صوتي", "واتساب ذكي", "أتمتة", "حجز مواعيد", "تذكيرات", "قاعدة معرفة"] : ["Voice agent", "Smart WhatsApp", "Automation", "Bookings", "Reminders", "Knowledge base"]).map((w, i) => (
                  <span key={w} className="flex items-center gap-10"><span className={i % 2 ? "text-mw-mint/40" : "text-mw-bright"}>{w}</span><span className="text-mw-gold">✦</span></span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section id="services" className="mx-auto max-w-7xl px-4 py-24 md:px-8">
          <SecHead tag={ar ? "منصة واحدة • ثلاث قوى" : "One platform • three powers"} title={ar ? "ليس مجرد رد على المكالمات" : "More than answering calls"} sub={ar ? "صوتي يجمع المكالمات وواتساب والأتمتة في وكيل واحد يعرف نشاطك وقاعدة معرفتك." : "Sawti combines calls, WhatsApp and automation in one agent that knows your business."} />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {pillars.map((p) => (
              <article key={p.title} className="rounded-3xl border border-mw-line bg-card p-8 transition hover:-translate-y-2 hover:shadow-xl">
                <div className="mw-grad flex size-14 items-center justify-center rounded-2xl text-primary-foreground"><p.icon className="size-7" /></div>
                <h3 className="mt-6 font-kufi text-2xl font-extrabold">{p.title}</h3>
                <p className="mt-3 leading-8 text-mw-muted">{p.desc}</p>
                <ul className="mt-6 space-y-2">{p.points.map((x) => <li key={x} className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5 text-mw-brand" />{x}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-card py-24">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <SecHead tag={ar ? "كيف تتكامل القنوات" : "How channels connect"} title={ar ? "رحلة عميل كاملة… تلقائياً" : "A full customer journey, automated"} sub={ar ? "من أول مكالمة إلى حضور الموعد، كل خطوة تتم بدون تدخل يدوي." : "From the first call to the visit, every step runs on its own."} />
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

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-24 md:grid-cols-2 md:px-8">
          <figure className="relative overflow-hidden rounded-3xl">
            <img src={waImg} alt={ar ? "صاحب منشأة يتابع ردود واتساب الآلية من جواله" : "Owner following automated WhatsApp replies"} width={1024} height={1024} loading="lazy" className="h-[420px] w-full object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-mw-night to-transparent p-6 font-kufi text-xl font-extrabold text-primary-foreground">{ar ? "عملاؤك يُخدمون على واتساب… وأنت مرتاح" : "Customers served on WhatsApp, while you relax"}</figcaption>
          </figure>
          <figure className="relative overflow-hidden rounded-3xl">
            <img src={autoImg} alt={ar ? "موجة صوتية تتحول إلى رسائل ومواعيد مؤتمتة" : "Voice turning into automated messages and bookings"} width={1280} height={800} loading="lazy" className="h-[420px] w-full object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-mw-night to-transparent p-6 font-kufi text-xl font-extrabold text-primary-foreground">{ar ? "من مكالمة إلى موعد مؤكد… تلقائياً" : "From a call to a confirmed booking"}</figcaption>
          </figure>
        </section>
        <IndustrySolutions />

        <section id="how" className="border-y border-landing-foreground/10 bg-saudi/30 py-24"><div className="mx-auto max-w-7xl px-4 md:px-8"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><span className="text-base font-semibold text-gold">{ar ? "من التسجيل للتشغيل" : "FROM SIGNUP TO LIVE"}</span><h2 className="mt-4 font-display text-3xl font-bold md:text-5xl">{copy.howTitle}</h2></div><p className="max-w-md text-lg leading-8 text-landing-muted">{ar ? "لا لف ولا دوران: عرّفنا على نشاطك، جهّز المعرفة، وصوتي يصير جاهزًا للاستقبال." : "Introduce your business, add its knowledge, and Sawti is ready to serve."}</p></div><div className="mt-14 grid gap-8 md:grid-cols-4">{[[Users, '01', ar ? 'عرّفنا بشركتك' : 'Add your company'], [BookOpen, '02', ar ? 'حمّل معلوماتك' : 'Share your knowledge'], [Headphones, '03', ar ? 'اضبط أسلوب الرد' : 'Shape the response'], [ShieldCheck, '04', ar ? 'تابع كل شيء' : 'Stay in control']].map(([Icon, n, label]) => { const StepIcon = Icon as typeof Users; return <div key={String(n)} className="border-t border-landing-foreground/15 pt-5"><div className="flex items-center justify-between"><StepIcon className="size-6 text-saudi-bright" /><span className="font-display text-base text-gold">{String(n)}</span></div><h3 className="mt-8 text-xl font-semibold">{String(label)}</h3></div>; })}</div></div></section>

        <section id="pricing" className="py-24"><div className="mx-auto max-w-7xl px-4 md:px-8"><div className="text-center"><h2 className="font-display text-3xl font-bold md:text-5xl">{copy.pricingTitle}</h2><p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-landing-muted">{copy.pricingSub}</p></div>
          <div className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-2 rounded-full border border-landing-foreground/10 p-1.5">{(["whatsapp", "voice", "bundle"] as const).map((p) => <button key={p} type="button" onClick={() => setProduct(p)} className={`flex-1 rounded-full px-4 py-2.5 text-base font-semibold transition-colors ${product === p ? 'bg-primary text-primary-foreground' : 'text-landing-muted hover:text-landing-foreground'}`}>{ar ? productLabels[p].ar : productLabels[p].en}</button>)}</div>
          <div className="mt-5 flex justify-center"><div className="inline-flex rounded-full border border-landing-foreground/10 p-1">{(["monthly", "yearly"] as const).map((p) => <button key={p} type="button" onClick={() => setPeriod(p)} className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${period === p ? 'bg-gold text-gold-foreground' : 'text-landing-muted hover:text-landing-foreground'}`}>{p === 'monthly' ? (ar ? 'شهري' : 'Monthly') : (ar ? 'سنوي — شهران مجاناً' : 'Yearly — 2 months free')}</button>)}</div></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">{plansFor(plans as PlanRow[] | undefined, product).map((plan, index) => <div key={plan.id} className={`rounded-lg border p-7 ${index === 1 ? 'border-gold bg-saudi/45' : 'border-landing-foreground/10 bg-landing-foreground/[0.03]'}`}><div className="flex items-center justify-between"><h3 className="text-2xl font-semibold">{ar ? plan.name_ar : plan.name_en}</h3>{index === 1 ? <span className="rounded-full bg-gold px-3 py-1 text-sm font-semibold text-gold-foreground">{ar ? 'الأكثر طلبًا' : 'Popular'}</span> : null}</div><p className="mt-7 font-display text-4xl font-bold">{periodPrice(Number(plan.price_sar), period).toFixed(0)} <span className="font-sans text-base font-normal text-landing-muted">{period === 'yearly' ? (ar ? 'ريال / سنة' : 'SAR / year') : t('perMonth')}</span></p><ul className="mt-7 space-y-3 text-base text-landing-muted">{([[plan.whatsapp_messages, t('whatsappMessages')], [plan.voice_minutes, t('voiceMinutes')], [plan.max_phone_numbers, ar ? 'رقم هاتف' : 'phone numbers'], [plan.max_agents, t('navAgents')]] as const).filter(([value]) => Number(value) > 0).map(([value, label]) => <li key={String(label)} className="flex items-center gap-2"><Check className="size-5 text-saudi-bright" />{value} {label}</li>)}{(ar ? productFeatures[product].ar : productFeatures[product].en).map((f) => <li key={f} className="flex items-center gap-2"><Check className="size-5 text-saudi-bright" />{f}</li>)}</ul><Button asChild className="mt-8 w-full" variant={index === 1 ? 'default' : 'outline'}><Link to="/auth" search={{ mode: 'signup' }}>{copy.try}</Link></Button></div>)}</div>
          {addonPrice(plans as PlanRow[] | undefined, product) !== null ? <p className="mt-8 text-center text-lg text-landing-muted">{product === 'whatsapp' ? (ar ? `إضافة المكالمات: +${addonPrice(plans as PlanRow[] | undefined, product)} ريال/شهر` : `Add calls: +${addonPrice(plans as PlanRow[] | undefined, product)} SAR/month`) : (ar ? `إضافة واتساب: +${addonPrice(plans as PlanRow[] | undefined, product)} ريال/شهر` : `Add WhatsApp: +${addonPrice(plans as PlanRow[] | undefined, product)} SAR/month`)}</p> : null}
          <p className="mt-4 text-center text-base text-landing-muted">{ar ? `للعيادات والمراكز الطبية: رسوم تأسيس ${CLINIC_SETUP_FEE_SAR} ريال تُدفع مرة واحدة (إعداد الأطباء والجداول والتذكيرات وقاعدة المعرفة).` : `Clinics: one-time ${CLINIC_SETUP_FEE_SAR} SAR setup fee (doctors, schedules, reminders and knowledge setup).`}</p>
        </div></section>

        <section id="faq" className="border-y border-landing-foreground/10 bg-saudi/30 py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 md:grid-cols-[0.8fr_1.2fr] md:px-8">
            <div>
              <span className="text-base font-semibold text-gold">{ar ? "قبل ما تبدأ" : "BEFORE YOU START"}</span>
              <h2 className="mt-4 font-display text-3xl font-bold md:text-5xl">{ar ? "أسئلة تتكرر.. وإجابات واضحة" : "Common questions, clear answers"}</h2>
              <p className="mt-5 text-lg leading-8 text-landing-muted">{ar ? "إذا بقي عندك سؤال، فريق صوتي قريب منك." : "If you still have a question, the Sawti team is here to help."}</p>
              <Button asChild variant="outline" className="mt-7"><Link to="/contact">{ar ? "تواصل معنا" : "Contact us"}</Link></Button>
            </div>
            <Accordion type="single" collapsible className="border-t border-landing-foreground/15">
              {faqs.map(([question, answer], index) => (
                <AccordionItem key={question} value={`faq-${index}`} className="border-landing-foreground/15">
                  <AccordionTrigger className="py-6 text-start text-lg hover:no-underline">{question}</AccordionTrigger>
                  <AccordionContent className="pb-6 text-base leading-8 text-landing-muted">{answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <img src={socialImage} alt={ar ? "صوتي — صوت أعمالك حاضر لعملائك" : "Sawti — your business voice, always present"} loading="lazy" width={1200} height={630} className="w-full rounded-lg border border-landing-foreground/10 object-cover" />
          </div>
        </section>

        <section className="border-t border-landing-foreground/10 bg-saudi py-20"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 md:flex-row md:items-center md:px-8"><div><h2 className="font-display text-3xl font-bold md:text-4xl">{copy.closing}</h2><p className="mt-3 max-w-2xl text-lg leading-8 text-landing-muted">{copy.closingSub}</p></div><Button asChild size="lg" className="shrink-0 bg-gold text-gold-foreground hover:bg-gold/90"><Link to="/auth" search={{ mode: 'signup' }}>{copy.try}<ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" /></Link></Button></div></section>

        <section aria-labelledby="partners-title" className="border-t border-landing-foreground/10 py-20">
          <div className="mx-auto max-w-7xl px-4 text-center md:px-8">
            <span className="text-base font-semibold text-gold">{ar ? "نبنيها معًا" : "BUILT TOGETHER"}</span>
            <h2 id="partners-title" className="mt-3 font-display text-3xl font-bold md:text-4xl">{copy.partnersTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-landing-muted">{copy.partnersSub}</p>
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
              <a href="https://meswar.com/" target="_blank" rel="noreferrer" aria-label={ar ? "زيارة موقع مسور الرسمي" : "Visit Meswar's official website"} className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg border border-landing-foreground/10 bg-primary p-6 transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <img src={meswarLogo.url} alt={ar ? "مسور — الشركة المطورة لمنتج صوتي" : "Meswar — the company behind Sawti"} width={362} height={171} className="max-h-24 w-auto max-w-full object-contain" />
              </a>
              <a href="https://www.meswar.com/Agent/" target="_blank" rel="noreferrer" aria-label={ar ? "زيارة موقع استشارات الذكاء الرسمي" : "Visit AI Consulting's official website"} className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg border border-landing-foreground/10 bg-saudi/25 p-5 transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <img src={aiConsultingLogo.url} alt={ar ? "استشارات الذكاء — شريك المنصة" : "AI Consulting — platform partner"} width={916} height={508} className="max-h-28 w-auto max-w-full object-contain" />
              </a>
            </div>
            <p className="mt-7 text-base font-semibold text-landing-foreground">{ar ? "صوتي — منتج من مسور" : "Sawti — A Meswar product"}</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/partners">{ar ? "تعرّف على شركائنا" : "Meet our partners"}</Link></Button>
          </div>
        </section>
      </main>
       <footer className="border-t border-landing-foreground/10 py-10"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 text-base text-landing-muted md:px-8"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div><SawtiLogo compact className="text-landing-foreground" /><p className="mt-1 text-sm">{ar ? "منتج من مسور" : "A Meswar product"}</p></div><nav className="flex flex-wrap gap-x-6 gap-y-2"><a href="#faq" className="hover:text-landing-foreground">{t("faq")}</a><Link to="/partners" className="hover:text-landing-foreground">{ar ? "الشركاء" : "Partners"}</Link><Link to="/contact" className="hover:text-landing-foreground">{t("contact")}</Link><Link to="/privacy" className="hover:text-landing-foreground">{ar ? "سياسة الخصوصية" : "Privacy"}</Link><Link to="/terms" className="hover:text-landing-foreground">{ar ? "الشروط والأحكام" : "Terms"}</Link></nav></div><div className="flex flex-col justify-between gap-2 border-t border-landing-foreground/10 pt-5 md:flex-row"><span>{ar ? "تقنية تخدم الناس.. مثل ما ينبغي" : "Technology that serves people properly"}</span><a href="mailto:meswar2030@gmail.com" dir="ltr" className="hover:text-landing-foreground">meswar2030@gmail.com</a><span>© {new Date().getFullYear()} Sawti</span></div></div></footer>
    </div>
  );
}