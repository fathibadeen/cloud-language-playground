/**
 * A4: subscription-cycle job
 * Reset usage counters when current_period_end is reached
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function run() {
  const now = new Date().toISOString();
  
  const { data: expiredSubs } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .lte("current_period_end", now);

  let processed = 0;
  let errors = 0;

  for (const sub of expiredSubs || []) {
    try {
      // Calculate next period (1 month forward)
      const nextPeriodEnd = new Date(sub.current_period_end!);
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

      await supabaseAdmin
        .from("subscriptions")
        .update({
          current_period_start: sub.current_period_end,
          current_period_end: nextPeriodEnd.toISOString(),
        })
        .eq("id", sub.id);

      processed++;
    } catch (error) {
      errors++;
      console.error(`[subscription-cycle] Sub ${sub.id}:`, error);
    }
  }

  // Ending-soon alerts (trials and paid periods) — deduped per period end.
  const { isEndingSoon } = await import("@/lib/notification-types");
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const { data: ending } = await supabaseAdmin
    .from("subscriptions")
    .select("id, company_id, status, current_period_end, cancel_at_period_end")
    .in("status", ["trialing", "active"])
    .gt("current_period_end", now)
    .lte("current_period_end", soon);
  let endingAlerts = 0;
  for (const sub of ending || []) {
    if (!isEndingSoon(sub.current_period_end)) continue;
    const day = String(sub.current_period_end).slice(0, 10);
    const trial = sub.status === "trialing";
    const { data: ok } = await supabaseAdmin.rpc("push_notification", {
      _company_id: sub.company_id,
      _category: "billing",
      _type: `sub_ending:${sub.id}:${day}`,
      _title: trial ? "الفترة التجريبية تنتهي قريباً" : "اشتراكك ينتهي قريباً",
      _body: `ينتهي في ${day}. جدّد من صفحة الفوترة حتى لا تتوقف الخدمة.`,
      _link: "/dashboard/billing",
      _severity: "warning",
    });
    if (ok) endingAlerts++;
  }

  return { processed, errors, details: { cycles_reset: processed, ending_alerts: endingAlerts } };
}
