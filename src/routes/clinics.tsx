import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, BellRing, BookOpen, CalendarCheck, Clock, ExternalLink, HeartPulse, MapPin, MessageCircle, PhoneCall, PhoneMissed, RotateCcw, ShieldCheck, Siren, Stethoscope, UserRound } from "lucide-react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const pageUrl = "https://www.sawti-ai.com/clinics";
const voiceDemoUrl = "https://app.nabrah.ai/call/wgt_S0L-5WWKeyrqTJmU2_vsyJd4";
const title = "وكيل صوتي للعيادات | لا تخسر مواعيد بسبب المكالمات الفائتة — صوتي";
const description = "صوتي يرد على مكالمات عيادتك وواتساب على مدار الساعة باللهجة السعودية، ويحجز المواعيد تلقائياً حتى بعد الدوام وأوقات الزحمة.";

export const Route = createFileRoute("/clinics")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: pageUrl }],
  }),
  component: ClinicsPage,
});

const pains = [
  { icon: PhoneMissed, t: "مكالمات بعد الدوام", d: "المريض يتصل الساعة 10 مساءً ولا يرد أحد، فيحجز عند عيادة ثانية." },
  { icon: Clock, t: "الاستقبال مشغول", d: "وقت الذروة، الموظفة مع مراجع والخط الثاني يرن بلا رد." },
  { icon: MessageCircle, t: "نفس الأسئلة كل يوم", d: "الأسعار، المواعيد المتاحة، الموقع، التأمين — تستهلك وقت فريقك." },
];

const steps = [
  { icon: PhoneCall, t: "يرد فوراً", d: "الوكيل يرد على المكالمة أو رسالة واتساب خلال ثوانٍ، ليلاً ونهاراً." },
  { icon: Stethoscope, t: "يفهم الطلب", d: "يسأل عن الخدمة أو الطبيب والوقت المناسب، ويجيب من معلومات عيادتك." },
  { icon: CalendarCheck, t: "يحجز الموعد", d: "يسجّل الموعد ضمن ساعات العمل، ويظهر مباشرة في لوحتك وتقويم Google." },
];

const features = [
  { icon: BellRing, t: "تذكير قبل 24 ساعة وساعتين", d: "رسالة واتساب للمريض يؤكد فيها حضوره أو يعيد الجدولة بضغطة — أقل تغيب، إيراد أكثر." },
  { icon: RotateCcw, t: "استرجاع المتغيبين", d: "من لم يحضر يتواصل معه الوكيل تلقائياً ويعرض عليه موعداً بديلاً." },
  { icon: UserRound, t: "حجز حسب الطبيب والتخصص", d: "يحجز ويعدّل ويلغي المواعيد حسب جدول دوام كل طبيب وخدماته." },
  { icon: HeartPulse, t: "متابعة بعد الزيارة", d: "«كيف حالك بعد الإجراء؟» — رسالة اهتمام ترفع رضا المرضى وتقييماتك." },
  { icon: MapPin, t: "تعليمات ما قبل الزيارة والموقع", d: "يرسل تعليمات الصيام أو الأوراق المطلوبة ورابط الخريطة وتفاصيل الوصول." },
  { icon: Siren, t: "تحويل الطوارئ فوراً", d: "الحالات الطارئة تُحوّل لموظف أو للإسعاف 997، والوكيل لا يشخّص أبداً." },
  { icon: BookOpen, t: "أسئلة شائعة جاهزة لكل تخصص", d: "أسنان، جلدية، تجميل، أطفال وغيرها — مع سياسات الإلغاء والدفع والتأمين." },
  { icon: BarChart3, t: "لوحة خاصة بالعيادة", d: "نسبة الحضور مقابل التغيب، المواعيد المحجوزة عبر الوكيل، أوقات الذروة والمكالمات الفائتة." },
];

function ClinicsPage() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <PublicPageShell>
      <div dir="rtl">
        <section className="mx-auto max-w-5xl px-4 py-16 text-center md:px-8 md:py-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-landing-foreground/15 px-4 py-1.5 text-sm text-landing-muted">
            <Stethoscope className="size-4" /> للعيادات والمجمعات الطبية
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
            كل مكالمة فائتة… موعد ضاع على عيادتك
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-landing-muted md:text-xl">
            صوتي يرد على مرضاك بالهاتف وواتساب على مدار الساعة باللهجة السعودية، ويحجز لهم الموعد تلقائياً — حتى لو كان فريقك مشغولاً أو العيادة مغلقة.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="text-base" onClick={() => setOpen(true)}>
              <PhoneCall className="size-5" /> جرّب مكالمة الآن
            </Button>
            <Button size="lg" variant="outline" className="text-base" asChild>
              <Link to="/contact">اطلب عرضاً لعيادتك</Link>
            </Button>
          </div>
        </section>

        <section className="border-y border-landing-foreground/10 bg-saudi/40 py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <h2 className="text-center font-display text-3xl font-bold">أين تضيع المواعيد؟</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {pains.map((p) => (
                <div key={p.t} className="rounded-2xl border border-landing-foreground/10 bg-landing p-6">
                  <p.icon className="size-7 text-gold" />
                  <h3 className="mt-4 text-xl font-semibold">{p.t}</h3>
                  <p className="mt-2 text-base leading-7 text-landing-muted">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <h2 className="text-center font-display text-3xl font-bold">كيف يحجز صوتي الموعد بدلاً عنك؟</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.t} className="rounded-2xl border border-landing-foreground/10 p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
                  <s.icon className="size-6 text-gold" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-base leading-7 text-landing-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-landing-foreground/10 bg-saudi/40 py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <p className="text-center text-sm font-semibold text-gold">حزمة صوتي للعيادات</p>
            <h2 className="mt-2 text-center font-display text-3xl font-bold md:text-4xl">قلّل التغيب… واسترجع إيرادك</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-landing-muted">كل موعد لا يحضره المريض كرسي فارغ وإيراد ضائع. صوتي يذكّر ويتابع ويعيد الجدولة بدلاً عن فريقك.</p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <div key={f.t} className="rounded-2xl border border-landing-foreground/10 bg-landing p-6">
                  <f.icon className="size-7 text-gold" />
                  <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
                  <p className="mt-2 text-base leading-7 text-landing-muted">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <h2 className="text-center font-display text-3xl font-bold">امتثال وخصوصية</h2>
          <ul className="mx-auto mt-8 grid max-w-3xl gap-3 text-base text-landing-muted sm:grid-cols-2">
            <li className="flex items-center gap-2"><ShieldCheck className="size-5 text-gold" /> تنبيه المريض بتسجيل المكالمة وأخذ موافقته</li>
            <li className="flex items-center gap-2"><ShieldCheck className="size-5 text-gold" /> بيانات كل عيادة منفصلة تماماً</li>
            <li className="flex items-center gap-2"><ShieldCheck className="size-5 text-gold" /> متوافق مع نظام حماية البيانات الشخصية (PDPL)</li>
            <li className="flex items-center gap-2"><ShieldCheck className="size-5 text-gold" /> أسعار بالريال وتشمل ضريبة القيمة المضافة</li>
          </ul>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-20 md:px-8">
          <div className="rounded-3xl border border-landing-foreground/10 bg-saudi/40 p-8 text-center md:p-12">
            <h2 className="font-display text-3xl font-bold">اسمعها بنفسك قبل أي قرار</h2>
            <p className="mt-3 text-lg text-landing-muted">اتصل بالوكيل التجريبي من متصفحك واطلب منه حجز موعد، كأنك مريض.</p>
            <Button size="lg" className="mt-6 text-base" onClick={() => setOpen(true)}>
              <PhoneCall className="size-5" /> جرّب مكالمة الآن
            </Button>
          </div>
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-4 sm:p-6" dir="rtl">
          <DialogHeader className="pe-8 text-start">
            <DialogTitle className="text-2xl">جرّب: احجز موعداً مع الوكيل</DialogTitle>
            <DialogDescription className="text-base leading-7">اسمح للمتصفح باستخدام الميكروفون، ثم قل مثلاً: «أبغى موعد يوم الأحد العصر».</DialogDescription>
          </DialogHeader>
          <div className="relative min-h-[520px] overflow-hidden rounded-lg border bg-muted/40">
            {!loaded ? <div className="absolute inset-0 grid place-items-center text-base font-medium text-muted-foreground">جارٍ تجهيز المكالمة…</div> : null}
            {open ? <iframe title="مكالمة تجريبية مع وكيل العيادة" src={voiceDemoUrl} allow="microphone; autoplay" onLoad={() => setLoaded(true)} className="relative h-[65vh] min-h-[520px] w-full border-0" /> : null}
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href={voiceDemoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />فتح التجربة في نافذة جديدة</a>
          </Button>
        </DialogContent>
      </Dialog>
    </PublicPageShell>
  );
}
