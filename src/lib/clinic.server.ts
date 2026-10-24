/** Server-only: builds the clinic section of an agent prompt from saved settings. */
import { MEDICAL_SAFETY_RULES, SPECIALTIES, type Specialty } from "@/lib/clinic";

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export async function buildClinicPrompt(companyId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: s }, { data: doctors }] = await Promise.all([
    supabaseAdmin.from("clinic_settings").select("*").eq("company_id", companyId).maybeSingle(),
    supabaseAdmin.from("clinic_doctors").select("name, specialty, work_days, start_time, end_time, services").eq("company_id", companyId).eq("is_active", true),
  ]);
  if (!s) return "";
  const instr = (s.pre_visit_instructions ?? {}) as Record<string, string>;
  return [
    "\n\nمعلومات العيادة:",
    `- التخصص: ${SPECIALTIES[s.specialty as Specialty] ?? s.specialty}.`,
    s.insurance?.length ? `- التأمين المقبول: ${s.insurance.join("، ")}.` : "",
    s.map_url ? `- الموقع على الخريطة: ${s.map_url}` : "",
    s.arrival_details ? `- تفاصيل الوصول: ${s.arrival_details}` : "",
    s.cancellation_policy ? `- سياسة الإلغاء: ${s.cancellation_policy}` : "",
    s.payment_policy ? `- الدفع: ${s.payment_policy}` : "",
    ...(doctors ?? []).map(
      (d) => `- د. ${d.name}${d.specialty ? ` (${d.specialty})` : ""}: ${(d.work_days ?? []).map((x: number) => DAYS[x]).join("، ")} من ${String(d.start_time).slice(0, 5)} إلى ${String(d.end_time).slice(0, 5)}${d.services?.length ? `، الخدمات: ${d.services.join("، ")}` : ""}.`,
    ),
    Object.keys(instr).length ? "- تعليمات ما قبل الزيارة: " + Object.entries(instr).map(([k, v]) => `${k}: ${v}`).join(" | ") : "",
    "- عند الحجز اسأل عن الطبيب أو التخصص، والتزم بأيام وساعات الطبيب. يمكن للمريض تعديل موعده أو إلغاؤه.",
    "- عند تأكيد الحجز أرسل الموقع وتعليمات ما قبل الزيارة الخاصة بالخدمة.",
    "\n" + MEDICAL_SAFETY_RULES(s.emergency_number || "997"),
  ].filter(Boolean).join("\n");
}
