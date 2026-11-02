export type ClinicCopy = { t: string; d: string };

export const PAINS: Record<"ar" | "en", ClinicCopy[]> = {
  ar: [
    { t: "مكالمات بعد الدوام", d: "المريض يتصل الساعة 10 مساءً ولا يرد أحد، فيحجز عند عيادة ثانية." },
    { t: "الاستقبال مشغول", d: "وقت الذروة، الموظفة مع مراجع والخط الثاني يرن بلا رد." },
    { t: "نفس الأسئلة كل يوم", d: "الأسعار، المواعيد المتاحة، الموقع، التأمين — تستهلك وقت فريقك." },
  ],
  en: [
    { t: "After-hours calls", d: "A patient calls at 10 PM, no one answers, and they book with another clinic." },
    { t: "Busy front desk", d: "At peak time the receptionist is with a patient while the second line rings unanswered." },
    { t: "The same questions daily", d: "Prices, available slots, location, insurance — eating up your team's time." },
  ],
};

export const STEPS: Record<"ar" | "en", ClinicCopy[]> = {
  ar: [
    { t: "يرد فوراً", d: "الوكيل يرد على المكالمة أو رسالة واتساب خلال ثوانٍ، ليلاً ونهاراً." },
    { t: "يفهم الطلب", d: "يسأل عن الخدمة أو الطبيب والوقت المناسب، ويجيب من معلومات عيادتك." },
    { t: "يحجز الموعد", d: "يسجّل الموعد ضمن ساعات العمل، ويظهر مباشرة في لوحتك وتقويم Google." },
  ],
  en: [
    { t: "Answers instantly", d: "The agent picks up calls and WhatsApp messages within seconds, day and night." },
    { t: "Understands the request", d: "It asks about the service or doctor and the preferred time, answering from your clinic's data." },
    { t: "Books the appointment", d: "It books within working hours and it appears instantly in your dashboard and Google Calendar." },
  ],
};

export const FEATURES: Record<"ar" | "en", ClinicCopy[]> = {
  ar: [
    { t: "تذكير قبل 24 ساعة وساعتين", d: "رسالة واتساب للمريض يؤكد فيها حضوره أو يعيد الجدولة بضغطة — أقل تغيب، إيراد أكثر." },
    { t: "استرجاع المتغيبين", d: "من لم يحضر يتواصل معه الوكيل تلقائياً ويعرض عليه موعداً بديلاً." },
    { t: "حجز حسب الطبيب والتخصص", d: "يحجز ويعدّل ويلغي المواعيد حسب جدول دوام كل طبيب وخدماته." },
    { t: "متابعة بعد الزيارة", d: "«كيف حالك بعد الإجراء؟» — رسالة اهتمام ترفع رضا المرضى وتقييماتك." },
    { t: "تعليمات ما قبل الزيارة والموقع", d: "يرسل تعليمات الصيام أو الأوراق المطلوبة ورابط الخريطة وتفاصيل الوصول." },
    { t: "تحويل الطوارئ فوراً", d: "الحالات الطارئة تُحوّل لموظف أو للإسعاف 997، والوكيل لا يشخّص أبداً." },
    { t: "أسئلة شائعة جاهزة لكل تخصص", d: "أسنان، جلدية، تجميل، أطفال وغيرها — مع سياسات الإلغاء والدفع والتأمين." },
    { t: "لوحة خاصة بالعيادة", d: "نسبة الحضور مقابل التغيب، المواعيد المحجوزة عبر الوكيل، أوقات الذروة والمكالمات الفائتة." },
  ],
  en: [
    { t: "Reminders 24h and 2h before", d: "A WhatsApp message lets the patient confirm attendance or reschedule in one tap — fewer no-shows, more revenue." },
    { t: "No-show recovery", d: "The agent automatically reaches out to patients who missed their visit and offers a new slot." },
    { t: "Booking per doctor & specialty", d: "Books, reschedules and cancels appointments according to each doctor's schedule and services." },
    { t: "Post-visit follow-up", d: "\"How are you feeling after the procedure?\" — a caring message that lifts patient satisfaction and reviews." },
    { t: "Pre-visit instructions & location", d: "Sends fasting instructions or required documents, plus a map link and arrival details." },
    { t: "Instant emergency escalation", d: "Emergencies are escalated to staff or ambulance 997 — the agent never diagnoses." },
    { t: "Ready FAQ per specialty", d: "Dental, dermatology, aesthetics, pediatrics and more — with cancellation, payment and insurance policies." },
    { t: "Clinic dashboard", d: "Attendance vs. no-shows, agent-booked appointments, peak hours and missed calls." },
  ],
};

export const COMPLIANCE: Array<{ ar: string; en: string }> = [
  { ar: "تنبيه المريض بتسجيل المكالمة وأخذ موافقته", en: "Patients are informed of call recording and give consent" },
  { ar: "بيانات كل عيادة منفصلة تماماً", en: "Each clinic's data is fully isolated" },
  { ar: "متوافق مع نظام حماية البيانات الشخصية (PDPL)", en: "Compliant with the Personal Data Protection Law (PDPL)" },
  { ar: "أسعار بالريال وتشمل ضريبة القيمة المضافة", en: "Prices in SAR, VAT included" },
];

export const HEAD = {
  pageUrl: "https://www.sawti-ai.com/clinics",
  ar: {
    title: "وكيل صوتي للعيادات | لا تخسر مواعيد بسبب المكالمات الفائتة — صوتي",
    description: "صوتي يرد على مكالمات عيادتك وواتساب على مدار الساعة باللهجة السعودية، ويحجز المواعيد تلقائياً حتى بعد الدوام وأوقات الزحمة.",
  },
  en: {
    title: "Voice Agent for Clinics | Stop Losing Appointments to Missed Calls — Sawti",
    description: "Sawti answers your clinic's calls and WhatsApp 24/7 in a natural Saudi dialect and books appointments automatically — even after hours and at peak times.",
  },
};
