/**
 * A3: usage-alerts job
 * Check usage quotas and create notifications for 80% threshold
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALERT_THRESHOLD = 0.8;

export async function run() {
  const { data: subscriptions } = await supabaseAdmin
    .from("subscriptions")
    .select("*, companies(id, name), plans(voice_minutes, whatsapp_messages)")
    .eq("status", "active")
    .not("current_period_end", "is", null);

  let processed = 0;
  let errors = 0;
  const alerts: string[] = [];

  for (const sub of subscriptions || []) {
    try {
      const plan = sub.plans as any;
      const company = sub.companies as any;
      
      // Voice usage
      if (plan.voice_minutes > 0) {
        const { data: usedV } = await supabaseAdmin.rpc("company_usage_this_month", { _company_id: sub.company_id, _metric: "voice_minutes" });
        const ratio = Number(usedV ?? 0) / plan.voice_minutes;
        if (ratio >= ALERT_THRESHOLD && ratio < 1) {
          await supabaseAdmin.from("notifications").insert({
            company_id: company.id,
            title: "Voice minutes running low",
            body: `You've used ${Math.round(ratio * 100)}% of your voice minutes`,
            type: "usage_alert",
          });
          alerts.push(`voice:${company.name}`);
        }
      }

      // WhatsApp usage
      if (plan.whatsapp_messages > 0) {
        const { data: usedW } = await supabaseAdmin.rpc("company_usage_this_month", { _company_id: sub.company_id, _metric: "whatsapp_messages" });
        const ratio = Number(usedW ?? 0) / plan.whatsapp_messages;
        if (ratio >= ALERT_THRESHOLD && ratio < 1) {
          await supabaseAdmin.from("notifications").insert({
            company_id: company.id,
            title: "WhatsApp messages running low",
            body: `You've used ${Math.round(ratio * 100)}% of your WhatsApp messages`,
            type: "usage_alert",
          });
          alerts.push(`whatsapp:${company.name}`);
        }
      }

      processed++;
    } catch (error) {
      errors++;
      console.error(`[usage-alerts] Sub ${sub.id}:`, error);
    }
  }

  return { processed, errors, details: { alerts_sent: alerts.length, alerts } };
}
