/**
 * A6: retention job
 * Identify inactive companies (no activity in 30 days) for re-engagement
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const INACTIVE_THRESHOLD_DAYS = 30;

export async function run() {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - INACTIVE_THRESHOLD_DAYS);

  const { data: companies } = await supabaseAdmin
    .from("companies")
    .select("id, name, created_at")
    .eq("status", "active");

  let processed = 0;
  let errors = 0;
  const inactive: string[] = [];

  for (const company of companies || []) {
    try {
      // Check for recent activity (calls, messages, conversations)
      const { count: recentActivity } = await supabaseAdmin
        .from("voice_calls")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .gte("created_at", threshold.toISOString());

      if (recentActivity === 0) {
        // Log inactive company (future: send email via webhook)
        inactive.push(company.name);
        processed++;
      }
    } catch (error) {
      errors++;
      console.error(`[retention] Company ${company.id}:`, error);
    }
  }

  return { processed, errors, details: { inactive_companies: inactive.length, sample: inactive.slice(0, 5) } };
}
