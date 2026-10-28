/** Business activities offered at sign-up; "clinic" unlocks the clinic suite. */
export const INDUSTRIES = [
  { value: "clinic", label: "عيادات ومراكز طبية" },
  { value: "restaurant", label: "مطاعم ومقاهي" },
  { value: "real_estate", label: "عقارات ومقاولات" },
  { value: "retail", label: "تجارة وتجزئة" },
  { value: "logistics", label: "نقل ولوجستيات" },
  { value: "collections", label: "تحصيل وتمويل وتقسيط" },
  { value: "beauty", label: "صالونات وتجميل" },
  { value: "education", label: "تعليم وتدريب" },
  { value: "services", label: "خدمات عامة" },
  { value: "other", label: "أخرى" },
] as const;

export function industryLabel(value: string | null | undefined): string {
  return INDUSTRIES.find((i) => i.value === value)?.label ?? value ?? "";
}

/** True when the company's activity is medical (also matches older free-text entries). */
export function isClinicIndustry(industry: string | null | undefined): boolean {
  if (!industry) return false;
  const v = industry.trim().toLowerCase();
  return v === "clinic" || /عياد|طبي|مستوصف|مجمع طبي|clinic|medical|dental/.test(v);
}
