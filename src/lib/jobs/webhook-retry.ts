/**
 * A1: webhook-retry job
 * Retry failed webhook_events with exponential backoff
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_RETRIES = 5;
const RETRY_BATCH_SIZE = 50;

export async function run() {
  const { data: failed } = await supabaseAdmin
    .from("webhook_events")
    .select("*")
    .eq("status", "failed")
    .lt("attempts", MAX_RETRIES)
    .order("created_at", { ascending: true })
    .limit(RETRY_BATCH_SIZE);

  let processed = 0;
  let errors = 0;

  for (const event of failed || []) {
    try {
      if (event.provider === "whatsapp") {
        const { ingestWhatsappMessage } = await import("@/lib/whatsapp-ingest.server");
        await ingestWhatsappMessage(event.payload);
      } else if (event.provider === "nabrah") {
        // Use provider_ref (agent UUID) if available
        const agentId = event.provider_ref;
        if (agentId) {
          const { ingestNabrahCall } = await import("@/lib/nabrah-ingest.server");
          await ingestNabrahCall(agentId, event.payload);
        } else {
          // Fallback: try to resolve from payload
          const providerAgentId = (event.payload as any)?.call?.agent_id;
          if (providerAgentId) {
            const { data: agent } = await supabaseAdmin
              .from("ai_agents")
              .select("id")
              .eq("provider_agent_id", providerAgentId)
              .single();
            if (agent) {
              const { ingestNabrahCall } = await import("@/lib/nabrah-ingest.server");
              await ingestNabrahCall(agent.id, event.payload);
            } else {
              throw new Error("Agent not found for provider_agent_id");
            }
          } else {
            throw new Error("No agent reference available");
          }
        }
      }

      await supabaseAdmin
        .from("webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", event.id);
      processed++;
    } catch (error) {
      errors++;
      await supabaseAdmin
        .from("webhook_events")
        .update({
          attempts: event.attempts + 1,
          error: error instanceof Error ? error.message : String(error),
        })
        .eq("id", event.id);
    }
  }

  return { processed, errors, details: { batch_size: failed?.length || 0 } };
}
