/**
 * sla-escalation job: open conversations waiting >15 min without a human become
 * "needs_human"; the database trigger raises the Arabic handoff notification.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ESCALATION_THRESHOLD_MINUTES = 15;

export async function run() {
  const threshold = new Date(Date.now() - ESCALATION_THRESHOLD_MINUTES * 60_000);

  const { data: pending } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("status", "open")
    .is("assigned_user_id", null)
    .lte("created_at", threshold.toISOString());

  let processed = 0;
  let errors = 0;
  for (const conv of pending || []) {
    const { error } = await supabaseAdmin.from("conversations").update({ status: "needs_human" }).eq("id", conv.id);
    if (error) {
      errors++;
      console.error(`[sla-escalation] Conversation ${conv.id}:`, error);
    } else processed++;
  }
  return { processed, errors, details: { escalated: processed } };
}
