/**
 * Clinic reminders job: 24h / 2h reminders, post-visit follow-up and no-show
 * recovery over WhatsApp. Bounded batch; each send is stamped so reruns skip it.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dueReminder, reminderText, type ReminderKind } from "@/lib/clinic";

const BATCH = 100;
const COLUMN: Record<ReminderKind, "reminder_24h_at" | "reminder_2h_at" | "followup_at" | "noshow_contacted_at"> = {
  "24h": "reminder_24h_at",
  "2h": "reminder_2h_at",
  followup: "followup_at",
  noshow: "noshow_contacted_at",
};
const TOGGLE: Record<ReminderKind, "reminder_24h" | "reminder_2h" | "followup_enabled" | "noshow_recovery"> = {
  "24h": "reminder_24h",
  "2h": "reminder_2h",
  followup: "followup_enabled",
  noshow: "noshow_recovery",
};

export async function run() {
  const now = new Date();
  const from = new Date(now.getTime() - 72 * 3_600_000).toISOString();
  const to = new Date(now.getTime() + 24 * 3_600_000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("appointments")
    .select("id, company_id, customer_name, customer_phone, service_name, start_time, status, reminder_24h_at, reminder_2h_at, followup_at, noshow_contacted_at")
    .gte("start_time", from)
    .lte("start_time", to)
    .not("customer_phone", "is", null)
    .in("status", ["confirmed", "rescheduled", "completed", "no_show"])
    .limit(BATCH);

  const settingsCache = new Map<string, any>();
  const meta = await import("@/lib/meta.server");
  let processed = 0;
  let errors = 0;
  let skipped = 0;

  for (const a of rows ?? []) {
    const kind = dueReminder(a, now);
    if (!kind) continue;
    if (!settingsCache.has(a.company_id)) {
      const [{ data: cs }, { data: co }, { data: wa }] = await Promise.all([
        supabaseAdmin.from("clinic_settings").select("*").eq("company_id", a.company_id).maybeSingle(),
        supabaseAdmin.from("companies").select("name").eq("id", a.company_id).maybeSingle(),
        supabaseAdmin.from("whatsapp_accounts").select("phone_number_id").eq("company_id", a.company_id).eq("is_active", true).limit(1).maybeSingle(),
      ]);
      settingsCache.set(a.company_id, { cs, name: co?.name ?? "العيادة", phoneNumberId: wa?.phone_number_id });
    }
    const { cs, name, phoneNumberId } = settingsCache.get(a.company_id);
    // Day-before reminder applies to every company; other kinds are clinic-only opt-ins.
    if (cs ? !cs[TOGGLE[kind]] : kind !== "24h") continue;

    const token = (await meta.loadCompanyWhatsappToken(a.company_id)) ?? process.env["WHATSAPP_API_KEY"];
    // Stamp first so a crash never double-sends; failures are recorded below.
    await supabaseAdmin.from("appointments").update({ [COLUMN[kind]]: now.toISOString() } as never).eq("id", a.id);
    const log = (status: "sent" | "failed" | "skipped", error?: string) =>
      supabaseAdmin.from("audit_logs").insert({
        company_id: a.company_id,
        action: `whatsapp.reminder_${status}`,
        entity: "appointments",
        entity_id: a.id,
        metadata: { kind, customer_name: a.customer_name, customer_phone: a.customer_phone, start_time: a.start_time, error: error ?? null },
      });
    if (!token || !phoneNumberId) {
      skipped++;
      await log("skipped", "لا يوجد رقم واتساب مربوط");
      continue;
    }
    const when = new Intl.DateTimeFormat("ar-SA", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(a.start_time));
    const instr = ((cs?.pre_visit_instructions ?? {}) as Record<string, string>)[a.service_name ?? ""] ?? null;
    const body = reminderText(kind, { clinic: name, name: a.customer_name, when, service: a.service_name, mapUrl: cs?.map_url, instructions: instr });
    const res = await meta.sendMetaText(phoneNumberId, token, String(a.customer_phone).replace(/\D/g, ""), body);
    if (res.ok) {
      processed++;
      await log("sent");
    } else {
      errors++;
      await log("failed", res.error ?? "خطأ");
      await supabaseAdmin.from("notifications").insert({
        company_id: a.company_id,
        title: "تعذر إرسال تذكير موعد",
        body: `${a.customer_name ?? a.customer_phone}: ${res.error ?? "خطأ"}`,
        type: "warning",
      });
    }
  }
  return { processed, errors, details: { scanned: rows?.length ?? 0, skipped } };
}
