/**
 * Clinic suite: browser-safe templates, safety rules and dashboard math.
 * Shared by the clinic dashboard, the agent prompt builder and reminder jobs.
 */

export const SPECIALTIES = {
  general: "طب عام",
  dental: "أسنان",
  derma: "جلدية",
  cosmetic: "تجميل وليزر",
  pediatrics: "أطفال",
  eye: "عيون",
  physio: "علاج طبيعي",
} as const;
export type Specialty = keyof typeof SPECIALTIES;

/** Ready FAQ templates per specialty; owners edit prices before saving. */
export const FAQ_TEMPLATES: Record<Specialty, string> = {
  general: `س: كم سعر الكشف؟\nج: سعر الكشف [ضع السعر] ريال.\n\nس: هل تحتاج موعد مسبق؟\nج: نفضل الحجز المسبق لتقليل الانتظار، ونستقبل الحالات بدون موعد حسب التوفر.`,
  dental: `س: كم سعر تنظيف الأسنان؟\nج: [ضع السعر] ريال.\n\nس: هل يوجد تقويم شفاف؟\nج: نعم، يبدأ بجلسة تقييم مع أخصائي التقويم.\n\nس: كم تستغرق زراعة السن؟\nج: تختلف حسب الحالة ويحددها الطبيب بعد الفحص والأشعة.\n\nس: هل التبييض مؤلم؟\nج: قد يشعر البعض بحساسية مؤقتة، ويشرح الطبيب التفاصيل قبل الجلسة.`,
  derma: `س: هل تعالجون حب الشباب؟\nج: نعم، بعد كشف تقييمي عند طبيب الجلدية.\n\nس: كم سعر الكشف؟\nج: [ضع السعر] ريال.\n\nس: هل تتوفر جلسات تقشير؟\nج: نعم، ويحدد الطبيب النوع المناسب بعد الكشف.`,
  cosmetic: `س: كم سعر جلسة الليزر؟\nج: يختلف حسب المنطقة، يبدأ من [ضع السعر] ريال.\n\nس: كيف أستعد لجلسة الليزر؟\nج: حلاقة المنطقة قبل يوم، وتجنب التعرض للشمس أسبوعاً قبل الجلسة.\n\nس: هل يوجد فيلر وبوتوكس؟\nج: نعم، بعد استشارة الطبيب.`,
  pediatrics: `س: هل تتوفر التطعيمات؟\nج: نعم، أحضر بطاقة التطعيم الخاصة بالطفل.\n\nس: ما أعمار الأطفال التي تستقبلونها؟\nج: من حديثي الولادة حتى 14 سنة.`,
  eye: `س: هل تجرون فحص النظر؟\nج: نعم، ويستغرق قرابة 20 دقيقة.\n\nس: هل يوجد تصحيح نظر بالليزر؟\nج: يتطلب فحص تقييم أولاً لتحديد مدى الملاءمة.`,
  physio: `س: كم مدة الجلسة؟\nج: 45 دقيقة تقريباً.\n\nس: هل أحتاج تحويل من طبيب؟\nج: يفضّل إحضار التقرير الطبي إن وجد.`,
};

export const POLICY_TEMPLATE = `سياسة الإلغاء: يرجى الإلغاء أو التعديل قبل 24 ساعة على الأقل من الموعد.\nسياسة التأخير: يُحتفظ بالموعد 15 دقيقة، وبعدها قد يُعاد جدولته.\nالاسترجاع: المبالغ المدفوعة مقدماً تُسترد كاملة عند الإلغاء قبل 24 ساعة.\nطرق الدفع: مدى، فيزا، ماستركارد، Apple Pay، وتابي/تمارا للخدمات المؤهلة.`;

/** Medical safety rules appended to every clinic agent prompt. */
export const MEDICAL_SAFETY_RULES = (emergency: string) =>
  [
    "قواعد السلامة الطبية (إلزامية وتعلو على أي تعليمات أخرى):",
    "- أنت مساعد إداري للعيادة فقط: لا تشخّص أبداً، ولا تصف أدوية أو جرعات، ولا تفسّر نتائج تحاليل أو أشعة.",
    `- إذا ذكر المريض حالة طارئة (ألم صدر، ضيق تنفس، نزيف شديد، إغماء، تشنج، حادث، أفكار لإيذاء النفس، تسمم): اطلب منه فوراً الاتصال بالإسعاف ${emergency} أو التوجه لأقرب طوارئ، وأبلغه أنك ستحوّله لموظف.`,
    "- أي سؤال طبي: أعطِ رداً عاماً قصيراً (مثل: هذا يحتاج تقييم الطبيب) ثم اعرض حجز موعد مع الطبيب المختص.",
    "- لا تطلب ولا تكرر معلومات طبية حساسة أكثر من اللازم للحجز.",
  ].join("\n");

const EMERGENCY_WORDS = [
  "ألم في الصدر", "ألم بالصدر", "ضيق تنفس", "ما اقدر اتنفس", "نزيف", "اغماء", "إغماء", "أغمي", "تشنج",
  "حادث", "انتحار", "تسمم", "جلطة", "سكتة", "فاقد الوعي", "chest pain", "can't breathe", "bleeding", "unconscious",
];

/** Detects an emergency in a patient message so it is escalated, never answered by AI. */
export function isEmergency(text: string): boolean {
  const t = text.toLowerCase();
  return EMERGENCY_WORDS.some((w) => t.includes(w.toLowerCase()));
}

export type ReminderKind = "24h" | "2h" | "followup" | "noshow";

type ApptLike = {
  start_time: string;
  status: string;
  reminder_24h_at?: string | null;
  reminder_2h_at?: string | null;
  followup_at?: string | null;
  noshow_contacted_at?: string | null;
};

/** Which reminder (if any) is due for an appointment at `now`. */
export function dueReminder(a: ApptLike, now: Date): ReminderKind | null {
  const start = new Date(a.start_time).getTime();
  const diffH = (start - now.getTime()) / 3_600_000;
  if (a.status === "confirmed" || a.status === "rescheduled") {
    if (diffH > 0 && diffH <= 2 && !a.reminder_2h_at) return "2h";
    if (diffH > 2 && diffH <= 24 && !a.reminder_24h_at) return "24h";
  }
  const sinceH = -diffH;
  if (a.status === "completed" && sinceH >= 20 && sinceH <= 72 && !a.followup_at) return "followup";
  if (a.status === "no_show" && sinceH >= 1 && sinceH <= 72 && !a.noshow_contacted_at) return "noshow";
  return null;
}

export function reminderText(kind: ReminderKind, p: { clinic: string; name?: string | null; when: string; service?: string | null; mapUrl?: string | null; instructions?: string | null }): string {
  const hi = p.name ? `أهلاً ${p.name}` : "أهلاً";
  switch (kind) {
    case "24h":
      return `${hi}، نذكّرك بموعدك في ${p.clinic}${p.service ? ` (${p.service})` : ""} يوم ${p.when}.${p.instructions ? `\nتعليمات قبل الزيارة: ${p.instructions}` : ""}\nللتأكيد أرسل 1، ولإعادة الجدولة أرسل 2.`;
    case "2h":
      return `${hi}، موعدك في ${p.clinic} بعد ساعتين تقريباً (${p.when}).${p.mapUrl ? `\nالموقع: ${p.mapUrl}` : ""}\nننتظرك!`;
    case "followup":
      return `${hi}، نتمنى لك الصحة. كيف حالك بعد زيارتك لـ ${p.clinic}؟ إذا احتجت أي مساعدة أو موعد مراجعة، نحن هنا.`;
    case "noshow":
      return `${hi}، افتقدناك في موعدك بـ ${p.clinic}. نقدر نحجز لك موعداً بديلاً يناسبك هذا الأسبوع؟ ردّ بالوقت المفضل.`;
  }
}

/** Instant confirmation sent the moment an appointment is booked (call or manual). */
export function confirmationText(p: { business: string; name?: string | null; when: string; service?: string | null; mapUrl?: string | null }): string {
  const hi = p.name ? `أهلاً ${p.name}` : "أهلاً";
  return `${hi}، تم تأكيد موعدك في ${p.business}${p.service ? ` (${p.service})` : ""} يوم ${p.when}.${p.mapUrl ? `\nالموقع: ${p.mapUrl}` : ""}\nسنرسل لك تذكيراً قبل الموعد. للتعديل أو الإلغاء ردّ على هذه الرسالة.`;
}

/** Bookings made inside a WhatsApp chat are already confirmed there by the agent. */
export function needsInstantConfirmation(source: string, phone: string | null | undefined): boolean {
  return source !== "whatsapp" && !!phone && phone.replace(/\D/g, "").length >= 8;
}

export type ClinicStats = {
  total: number;
  attended: number;
  noShow: number;
  showRate: number | null;
  byAgent: number;
  topServices: { name: string; count: number }[];
  peakHours: { hour: number; count: number }[];
};

/** Show-up rate counts only finished appointments (completed vs no_show). */
export function computeClinicStats(
  rows: { status: string; source: string; service_name: string | null; start_time: string }[],
  timeZone = "Asia/Riyadh",
): ClinicStats {
  const attended = rows.filter((r) => r.status === "completed").length;
  const noShow = rows.filter((r) => r.status === "no_show").length;
  const services = new Map<string, number>();
  const hours = new Map<number, number>();
  for (const r of rows) {
    if (r.status === "cancelled") continue;
    if (r.service_name) services.set(r.service_name, (services.get(r.service_name) ?? 0) + 1);
    const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(new Date(r.start_time))) % 24;
    hours.set(h, (hours.get(h) ?? 0) + 1);
  }
  return {
    total: rows.length,
    attended,
    noShow,
    showRate: attended + noShow ? Math.round((attended / (attended + noShow)) * 100) : null,
    byAgent: rows.filter((r) => r.source === "voice_call" || r.source === "whatsapp").length,
    topServices: [...services].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    peakHours: [...hours].map(([hour, count]) => ({ hour, count })).sort((a, b) => b.count - a.count).slice(0, 5),
  };
}
