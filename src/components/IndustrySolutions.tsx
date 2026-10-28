import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Wallet, Home, MessageCircle, Mic, Scale, Scissors, Stethoscope, Truck, UtensilsCrossed } from "lucide-react";

type Solution = {
  icon: typeof Stethoscope;
  badge: string;
  status: string;
  channel: "voice" | "whatsapp";
  title: string;
  pain: string;
  ask: string;
  reply: string;
  points: string[];
  to?: "/clinics";
  accent: string;
};

export const SOLUTIONS: Solution[] = [
  { accent: "var(--sol-mint)", icon: Stethoscope, badge: "الأكثر طلبًا", status: "رد فوري", channel: "voice", title: "العيادات والمراكز الطبية", pain: "مواعيد ضائعة ومكالمات بلا رد وقت الذروة.", ask: "أحتاج موعد أسنان بكرة", reply: "تم تأكيد موعدك غدًا 4:00م مع الطبيب وأرسلنا الموقع 📍", points: ["حجز وتعديل المواعيد حسب جدول كل طبيب", "تذكير قبل 24 ساعة وساعتين لتقليل التغيب", "تحويل الحالات الطارئة فورًا لموظف"], to: "/clinics" },
  { accent: "var(--sol-gold)", icon: Scale, badge: "سرية تامة", status: "24/7", channel: "whatsapp", title: "مكاتب المحاماة والاستشارات", pain: "اتصالات العملاء تضيع أثناء الجلسات والاجتماعات.", ask: "عندي استشارة عمالية مستعجلة", reply: "سجّلنا التفاصيل وحجزنا لك استشارة اليوم ⚖️", points: ["استقبال الاستشارات الأولية وجمع بيانات القضية", "جدولة مواعيد مع المحامي المختص", "رد 24/7 بأسلوب مهني"] },
  { accent: "var(--sol-sky)", icon: Home, badge: "عملاء جادّون", status: "رد فوري", channel: "whatsapp", title: "العقارات وإدارة الأملاك", pain: "تأخر الرد على المهتمين بالإعلانات يضيّع الصفقة.", ask: "مهتم بالفيلا المعروضة", reply: "أرسلنا التفاصيل والموقع، تحب نحجز موعد معاينة؟ 🏡", points: ["فرز العملاء الجادين تلقائيًا", "حجز مواعيد المعاينة", "إرسال تفاصيل العقار عبر واتساب"] },
  { accent: "var(--sol-amber)", icon: UtensilsCrossed, badge: "وقت الذروة", status: "بدون انتظار", channel: "voice", title: "المطاعم والمقاهي", pain: "ضغط المكالمات وطلبات الحجز في أوقات الذروة.", ask: "حجز طاولة لـ 4 يوم الجمعة", reply: "تم تأكيد حجزك الجمعة 8:30م وأرسلنا المنيو ✅", points: ["تأكيد حجوزات الطاولات والمناسبات", "إرسال المنيو والموقع عبر واتساب", "الرد على الأسئلة المتكررة"] },
  { accent: "var(--sol-rose)", icon: Scissors, badge: "حجز أسهل", status: "تذكير آلي", channel: "whatsapp", title: "الصالونات ومراكز التجميل", pain: "كثرة تعديل المواعيد والسؤال عن الأسعار.", ask: "أبغى جلسة عناية بالبشرة", reply: "تم حجز موعدك وأرسلنا تعليمات ما قبل الجلسة 💅", points: ["اختيار الخدمة والأخصائية", "تذكير آلي بالموعد", "عرض البكجات والعروض"] },
  { accent: "var(--sol-violet)", icon: Wallet, badge: "تحصيل أسرع", status: "تذكير آلي", channel: "voice", title: "التحصيل والتذكير بالدفعات", pain: "متأخرات تتراكم وفريق يقضي يومه في مكالمات التذكير.", ask: "متى موعد القسط القادم؟", reply: "قسطك 1,250 ر.س يستحق الأحد، أرسلنا لك رابط سداد آمن 💳", points: ["اتصال وتذكير قبل الاستحقاق وبعده بلباقة", "إرسال رابط دفع رسمي عبر واتساب", "تسجيل وعود السداد وتحويل الاعتراضات لموظف"] },
  { accent: "var(--sol-blue)", icon: Truck, badge: "تتبع 24/7", status: "24/7", channel: "voice", title: "شركات النقل واللوجستيات", pain: "سيل مكالمات «وين شحنتي؟» يستنزف فريق خدمة العملاء.", ask: "وين شحنتي رقم 9821؟", reply: "شحنتك خرجت للتوصيل اليوم مع المندوب 🚚", points: ["رد فوري على تتبع الشحنات عبر رقم البوليصة", "استقبال طلبات الاستلام ونقل العفش", "الأسعار ومناطق التغطية والمواد الممنوعة"] },
];

export function IndustrySolutions() {
  return (
    <section id="solutions" aria-labelledby="solutions-title" className="border-y border-landing-foreground/10 bg-saudi/30 py-24" dir="rtl">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <span className="text-base font-semibold text-gold">حلول حسب قطاعك</span>
        <h2 id="solutions-title" className="mt-4 font-display text-3xl font-bold md:text-5xl">حلول مصممة لنشاطك</h2>
        <p className="mt-5 max-w-3xl text-xl leading-9 text-landing-muted">اسحب لتكتشف كيف يرد صوتي على عملاء قطاعك فعليًا.</p>
      </div>
      <div className="mx-auto mt-12 max-w-7xl">
        <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-8 pt-2 md:px-8 [scrollbar-width:thin]">
          {SOLUTIONS.map((s, i) => {
            const Channel = s.channel === "voice" ? Mic : MessageCircle;
            const d = (n: number) => ({ animationDelay: `${i * 0.4 + n}s` });
            return (
              <article key={s.title} className="sol-card group relative flex min-h-[520px] w-[80%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-landing-foreground/15 bg-landing p-7 sm:w-[350px]" style={{ ["--a" as string]: s.accent, backgroundImage: "linear-gradient(160deg, color-mix(in oklab, var(--a) 16%, transparent), transparent 55%)", borderTop: "3px solid var(--a)" }}>
                <div aria-hidden className="pointer-events-none absolute -top-20 -left-20 size-48 rounded-full bg-[color-mix(in_oklab,var(--a)_35%,transparent)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative flex items-center justify-between">
                  <span className="grid size-14 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--a)_20%,transparent)] transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110"><s.icon className="size-7 text-[var(--a)]" /></span>
                  <span className="rounded-full border border-[var(--a)] px-3 py-1 text-sm font-semibold text-[var(--a)]">{s.badge}</span>
                </div>
                <h3 className="relative mt-6 text-2xl font-bold">{s.title}</h3>
                <p className="relative mt-2 text-base leading-7 text-landing-muted">{s.pain}</p>

                <div className="relative mt-5 rounded-xl border border-landing-foreground/10 bg-landing-foreground/5 p-4">
                  <div className="mb-3 flex items-center justify-between text-xs text-landing-muted">
                    <span className="inline-flex items-center gap-1.5"><Channel className="size-3.5 text-[var(--a)]" />{s.channel === "voice" ? "مكالمة" : "واتساب"}</span>
                    <span className="inline-flex items-center gap-1.5"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--a)] opacity-70" /><span className="relative inline-flex size-2 rounded-full bg-[var(--a)]" /></span>{s.status}</span>
                  </div>
                  <p className="sol-msg ms-auto w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-landing-foreground/10 px-3 py-2 text-sm" style={d(0)}>{s.ask}</p>
                  <div className="sol-typing mt-2 flex w-fit gap-1 rounded-2xl bg-[color-mix(in_oklab,var(--a)_18%,transparent)] px-3 py-2" style={d(0.8)}>
                    {[0, 1, 2].map((k) => <span key={k} className="size-1.5 animate-bounce rounded-full bg-[var(--a)]" style={{ animationDelay: `${k * 0.15}s` }} />)}
                  </div>
                  <p className="sol-reply mt-2 w-fit max-w-[90%] rounded-2xl rounded-tr-sm bg-[color-mix(in_oklab,var(--a)_18%,transparent)] px-3 py-2 text-sm leading-6" style={d(1.8)}>{s.reply}</p>
                </div>

                <ul className="relative mt-5 space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2 text-sm leading-6"><Check className="mt-0.5 size-4 shrink-0 text-[var(--a)]" />{p}</li>
                  ))}
                </ul>
                <div className="relative mt-auto pt-6">
                  <Link to={s.to ?? "/contact"} className="inline-flex items-center gap-2 font-semibold text-[var(--a)] hover:underline">
                    {s.to ? "اكتشف الحل" : "اطلب تجربة مخصصة"}<ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
