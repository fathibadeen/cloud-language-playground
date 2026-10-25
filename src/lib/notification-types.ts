/** Notification categories customers can tune; `critical` ones are also meant for email. */
export const NOTIFICATION_CATEGORIES = [
  { key: "emergency", label: "حالات طارئة", hint: "رسالة توحي بحالة طبية طارئة حُوّلت لموظف", critical: true },
  { key: "appointment_new", label: "موعد جديد", hint: "حجز أنشأه الوكيل من مكالمة أو واتساب", critical: false },
  { key: "no_show", label: "عدم حضور", hint: "موعد تحوّلت حالته إلى «لم يحضر»", critical: false },
  { key: "missed_call", label: "مكالمات فائتة", hint: "مكالمة لم تكتمل وتحتاج معاودة اتصال", critical: false },
  { key: "handoff", label: "تحويل لموظف", hint: "محادثة تنتظر رداً بشرياً", critical: false },
  { key: "usage", label: "الاستهلاك", hint: "عند بلوغ 80% و100% من دقائق أو رسائل الباقة", critical: true },
  { key: "billing", label: "الدفع والاشتراك", hint: "نجاح الدفع أو فشله وقرب انتهاء الاشتراك", critical: true },
  { key: "channel", label: "ربط القنوات", hint: "انقطاع ربط واتساب أو الرقم", critical: true },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

/** Days before period end at which the "subscription ending" alert fires. */
export const SUBSCRIPTION_ENDING_DAYS = 3;

/** Whether a subscription should get an "ending soon" alert now. */
export function isEndingSoon(periodEnd: string | Date, now: Date = new Date()): boolean {
  const end = new Date(periodEnd).getTime();
  const diff = end - now.getTime();
  return diff > 0 && diff <= SUBSCRIPTION_ENDING_DAYS * 86_400_000;
}

/** Usage alert level for a used/limit pair: 100, 80, or null. */
export function usageLevel(used: number, limit: number): 80 | 100 | null {
  if (!limit || limit <= 0) return null;
  const pct = (used / limit) * 100;
  return pct >= 100 ? 100 : pct >= 80 ? 80 : null;
}
