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
          usage_voice: 0,
          usage_whatsapp: 0,
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

  return { processed, errors, details: { cycles_reset: processed } };
}
