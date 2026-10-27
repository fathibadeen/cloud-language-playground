/**
 * Sends the instant WhatsApp confirmation for a new appointment through the
 * company's own connected Meta number. Best effort: failures become a notification.
 */
import { confirmationText, needsInstantConfirmation } from "@/lib/clinic";

export async function sendAppointmentConfirmation(appointmentId: string): Promise<{ sent: boolean; reason?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: a } = await supabaseAdmin
    .from("appointments")
    .select("id, company_id, customer_name, customer_phone, service_name, start_time, source, status")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!a) return { sent: false, reason: "not_found" };
  if (a.status !== "confirmed" || !needsInstantConfirmation(a.source, a.customer_phone)) return { sent: false, reason: "not_needed" };

  const [{ data: co }, { data: wa }, { data: cs }, { data: bs }] = await Promise.all([
    supabaseAdmin.from("companies").select("name").eq("id", a.company_id).maybeSingle(),
    supabaseAdmin.from("whatsapp_accounts").select("phone_number_id").eq("company_id", a.company_id).eq("is_active", true).limit(1).maybeSingle(),
    supabaseAdmin.from("clinic_settings").select("map_url").eq("company_id", a.company_id).maybeSingle(),
    supabaseAdmin.from("booking_settings").select("timezone").eq("company_id", a.company_id).maybeSingle(),
  ]);
  if (!wa?.phone_number_id) return { sent: false, reason: "whatsapp_not_connected" };
  const meta = await import("@/lib/meta.server");
  const token = await meta.loadCompanyWhatsappToken(a.company_id);
  if (!token) return { sent: false, reason: "token_missing" };

  const when = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: bs?.timezone || "Asia/Riyadh",
  }).format(new Date(a.start_time));
  const body = confirmationText({ business: co?.name ?? "", name: a.customer_name, when, service: a.service_name, mapUrl: cs?.map_url });
  const res = await meta.sendMetaText(wa.phone_number_id, token, String(a.customer_phone).replace(/\D/g, ""), body);
  if (!res.ok) {
    await supabaseAdmin.from("notifications").insert({
      company_id: a.company_id,
      title: "تعذر إرسال تأكيد الموعد عبر واتساب",
      body: `${a.customer_name ?? a.customer_phone}: ${res.error ?? "خطأ"}`,
      type: "warning",
    });
    return { sent: false, reason: res.error ?? "send_failed" };
  }
  return { sent: true };
}
