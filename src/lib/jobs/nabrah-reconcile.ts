/**
 * A2: nabrah-reconcile job
 * Poll Nabrah for calls created in last 24h that we might have missed
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function run() {
  const { data: agents } = await supabaseAdmin
    .from("ai_agents")
    .select("id, provider_agent_id, company_id")
    .eq("provider", "nabrah")
    .eq("is_active", true)
    .not("provider_agent_id", "is", null);

  let processed = 0;
  let errors = 0;

  for (const agent of agents || []) {
    try {
      // Import nabrah server functions
      const nabrah = await import("@/lib/nabrah.server");
      if (!nabrah.nabrahConfigured()) continue;

      // Search for recent calls (last 24 hours)
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const list = await nabrah.searchCalls({ 
        limit: 100, 
        offset: 0, 
        created_at_start: since,
        agent_id: agent.provider_agent_id! 
      });

      // Filter calls for this agent
      const mine = list.calls.filter((c: any) => c.agent_id === agent.provider_agent_id);

      for (const call of mine) {
        // Check if we already have this call
        const { data: existing } = await supabaseAdmin
          .from("voice_calls")
          .select("id")
          .eq("external_call_id", call.call_id)
          .maybeSingle();

        if (!existing) {
          // Import the call using ingest function
          const { ingestNabrahCall } = await import("@/lib/nabrah-ingest.server");
          await ingestNabrahCall(agent.id, { call });
          processed++;
        }
      }
    } catch (error) {
      errors++;
      console.error(`[nabrah-reconcile] Agent ${agent.id}:`, error);
    }
  }

  return { processed, errors, details: { agents_checked: agents?.length || 0 } };
}
