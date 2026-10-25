import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Home, Scale, Scissors, Stethoscope, Truck, UtensilsCrossed } from "lucide-react";

const SOLUTIONS: { icon: typeof Stethoscope; badge: string; title: string; pain: string; points: string[]; to?: "/clinics" }[] = [
  { icon: Stethoscope, badge: "الأكثر طلبًا", title: "العيادات والمراكز الطبية", pain: "مواعيد ضائعة ومكالمات بلا رد وقت الذروة.", points: ["حجز وتعديل المواعيد حسب جدول كل طبيب", "تذكير قبل 24 ساعة وساعتين لتقليل التغيب", "تحويل الحالات الطارئة فورًا لموظف"], to: "/clinics" as const },
  { icon: Scale, badge: "سرية تامة", title: "مكاتب المحاماة والاستشارات", pain: "اتصالات العملاء تضيع أثناء الجلسات والاجتماعات.", points: ["استقبال الاستشارات الأولية وجمع بيانات القضية", "جدولة مواعيد مع المحامي المختص", "رد 24/7 بأسلوب مهني"] },
  { icon: Home, badge: "عملاء جادّون", title: "العقارات وإدارة الأملاك", pain: "تأخر الرد على المهتمين بالإعلانات يضيّع الصفقة.", points: ["فرز العملاء الجادين تلقائيًا", "حجز مواعيد المعاينة", "إرسال تفاصيل العقار عبر واتساب"] },
  { icon: UtensilsCrossed, badge: "وقت الذروة", title: "المطاعم والمقاهي", pain: "ضغط المكالمات وطلبات الحجز في أوقات الذروة.", points: ["تأكيد حجوزات الطاولات والمناسبات", "إرسال المنيو والموقع عبر واتساب", "الرد على الأسئلة المتكررة"] },
  { icon: Scissors, badge: "حجز أسهل", title: "الصالونات ومراكز التجميل", pain: "كثرة تعديل المواعيد والسؤال عن الأسعار.", points: ["اختيار الخدمة والأخصائية", "تذكير آلي بالموعد", "عرض البكجات والعروض"] },
  { icon: Truck, badge: "تتبع 24/7", title: "شركات النقل واللوجستيات", pain: "سيل مكالمات «وين شحنتي؟» يستنزف فريق خدمة العملاء.", points: ["رد فوري على تتبع الشحنات عبر رقم البوليصة", "استقبال طلبات الاستلام ونقل العفش", "الأسعار ومناطق التغطية والمواد الممنوعة"] },
];

export function IndustrySolutions() {
  return (
    <section id="solutions" aria-labelledby="solutions-title" className="border-y border-landing-foreground/10 bg-saudi/30 py-24" dir="rtl">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <span className="text-base font-semibold text-gold">حلول حسب قطاعك</span>
        <h2 id="solutions-title" className="mt-4 font-display text-3xl font-bold md:text-5xl">حلول مصممة لنشاطك</h2>
        <p className="mt-5 max-w-3xl text-xl leading-9 text-landing-muted">اسحب لتكتشف كيف يخدم صوتي قطاعك بلغته ومشاكله اليومية.</p>
      </div>
      <div className="mx-auto mt-12 max-w-7xl">
        <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 md:px-8 [scrollbar-width:thin]">
          {SOLUTIONS.map((s) => (
            <article key={s.title} className="flex w-[78%] shrink-0 snap-start flex-col rounded-2xl border border-landing-foreground/15 bg-landing p-7 sm:w-[340px] min-h-[460px]">
              <div className="flex items-center justify-between">
                <span className="grid size-14 place-items-center rounded-xl bg-saudi/60"><s.icon className="size-7 text-saudi-bright" /></span>
                <span className="rounded-full border border-gold/40 px-3 py-1 text-sm font-semibold text-gold">{s.badge}</span>
              </div>
              <h3 className="mt-7 text-2xl font-bold">{s.title}</h3>
              <p className="mt-3 text-base leading-7 text-landing-muted">{s.pain}</p>
              <ul className="mt-6 space-y-3">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2 text-base leading-7"><Check className="mt-1 size-5 shrink-0 text-saudi-bright" />{p}</li>
                ))}
              </ul>
              <div className="mt-auto pt-7">
                <Link to={s.to ?? "/contact"} className="inline-flex items-center gap-2 font-semibold text-gold hover:underline">
                  {s.to ? "اكتشف الحل" : "اطلب تجربة مخصصة"}<ArrowLeft className="size-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
