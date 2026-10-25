/**
 * usage-alerts job: one Arabic notification per metric, threshold (80/100) and month.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { usageLevel } from "@/lib/notification-types";

const METRICS = [
  { metric: "voice_minutes", ar: "دقائق المكالمات" },
  { metric: "whatsapp_messages", ar: "رسائل واتساب" },
] as const;

export async function run() {
  const { data: subscriptions } = await supabaseAdmin
    .from("subscriptions")
    .select("id, company_id, plans(voice_minutes, whatsapp_messages)")
    .in("status", ["active", "trialing"]);

  let processed = 0;
  let errors = 0;
  let sent = 0;
  const month = new Date().toISOString().slice(0, 7);

  for (const sub of subscriptions || []) {
    try {
      const plan = sub.plans as unknown as Record<string, number> | null;
      if (!plan) continue;
      for (const m of METRICS) {
        const limit = Number(plan[m.metric] ?? 0);
        const { data: used } = await supabaseAdmin.rpc("company_usage_this_month", { _company_id: sub.company_id, _metric: m.metric });
        const level = usageLevel(Number(used ?? 0), limit);
        if (!level) continue;
        const { data: ok } = await supabaseAdmin.rpc("push_notification", {
          _company_id: sub.company_id,
          _category: "usage",
          _type: `usage_${m.metric}_${level}_${month}`,
          _title: level === 100 ? `انتهت ${m.ar} لهذا الشهر` : `اقتربت من حد ${m.ar}`,
          _body: level === 100 ? `استهلكت كامل ${m.ar} في باقتك. رقّ باقتك لمواصلة الخدمة.` : `استهلكت ${level}% أو أكثر من ${m.ar} في باقتك.`,
          _link: "/dashboard/usage",
          _severity: level === 100 ? "error" : "warning",
        });
        if (ok) sent++;
      }
      processed++;
    } catch (error) {
      errors++;
      console.error(`[usage-alerts] Sub ${sub.id}:`, error);
    }
  }

  return { processed, errors, details: { alerts_sent: sent } };
}
