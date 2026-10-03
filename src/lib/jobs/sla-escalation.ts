/**
 * A5: sla-escalation job
 * Escalate conversations pending for >15 min without agent assignment
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ESCALATION_THRESHOLD_MINUTES = 15;

export async function run() {
  const threshold = new Date();
  threshold.setMinutes(threshold.getMinutes() - ESCALATION_THRESHOLD_MINUTES);

  const { data: pending } = await supabaseAdmin
    .from("conversations")
    .select("*, companies(id, name)")
    .eq("status", "pending")
    .is("assigned_user_id", null)
    .lte("created_at", threshold.toISOString());

  let processed = 0;
  let errors = 0;

  for (const conv of pending || []) {
    try {
      const company = conv.companies as any;
      
      await supabaseAdmin.from("notifications").insert({
        company_id: company.id,
        title: "Conversation requires attention",
        body: `Conversation ${conv.id.slice(0, 8)} has been waiting for ${ESCALATION_THRESHOLD_MINUTES}+ minutes`,
        type: "sla_escalation",
      });

      // Update conversation status to 'escalated'
      await supabaseAdmin
        .from("conversations")
        .update({ status: "escalated" })
        .eq("id", conv.id);

      processed++;
    } catch (error) {
      errors++;
      console.error(`[sla-escalation] Conversation ${conv.id}:`, error);
    }
  }

  return { processed, errors, details: { escalated: processed } };
}
