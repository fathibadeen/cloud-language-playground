import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const companySchema = z.object({ companyId: z.string().uuid() });
const SITE = "https://www.sawti-ai.com";

async function role(supabase: { from: (t: string) => any }, companyId: string, userId: string) {
  const { data } = await supabase
    .from("company_members").select("role")
    .eq("company_id", companyId).eq("user_id", userId).maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

/** Honest Nabrah status for the voice page, plus the agent's webhook URL for admins. */
export const nabrahStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agent } = await supabaseAdmin
      .from("ai_agents").select("id, provider_agent_id, direct_link")
      .eq("company_id", data.companyId).eq("channel", "voice")
      .order("created_at").limit(1).maybeSingle();

    const configured = !!process.env["NABRAH_API_KEY"];
    let webhookUrl: string | null = null;
    if (agent && ["owner", "admin"].includes(r) && process.env["NABRAH_WEBHOOK_SECRET"]) {
      const { agentWebhookToken } = await import("./nabrah.server");
      webhookUrl = `${SITE}/api/public/webhooks/nabrah?agent=${agent.id}&token=${agentWebhookToken(agent.id)}`;
    }
    const status = !configured
      ? ("not_connected" as const)
      : agent?.direct_link || agent?.provider_agent_id
        ? ("connected" as const)
        : ("pending" as const);
    return {
      status,
      agentId: agent?.id ?? null,
      nabrahAgentId: agent?.provider_agent_id ?? null,
      directLink: agent?.direct_link ?? null,
      webhookUrl,
    };
  });

const linkSchema = z.object({
  companyId: z.string().uuid(),
  agentId: z.string().uuid(),
  directLink: z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), "https_only").nullable(),
  nabrahAgentId: z.string().trim().max(200).nullable(),
});

/** Links a platform voice agent to its Nabrah agent (direct link + id). */
export const linkNabrahAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => linkSchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("ai_agents")
      .update({
        provider: "nabrah",
        direct_link: data.directLink,
        provider_agent_id: data.nabrahAgentId || null,
        provider_status: data.directLink || data.nabrahAgentId ? "connected" : "not_connected",
        provider_error: null,
      })
      .eq("id", data.agentId).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Kept for existing callers (signup / numbers). Nabrah agents are created in
 * the Nabrah dashboard, so this only marks the voice agent as Nabrah-managed
 * and reports that manual linking is required — never a fake success.
 */
export const provisionCompanyVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const { data: agent } = await context.supabase
      .from("ai_agents").select("id, direct_link, provider_agent_id")
      .eq("company_id", data.companyId).eq("channel", "voice").limit(1).maybeSingle();
    if (!agent) return { status: "not_connected" as const, reason: "no_voice_agent" };
    if (agent.direct_link || agent.provider_agent_id) return { status: "connected" as const, reason: null };
    return { status: "pending" as const, reason: "nabrah_link_required" };
  });

/** Lists the Nabrah agents available on the account so an admin can pick one. */
export const listNabrahAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const nabrah = await import("./nabrah.server");
    if (!nabrah.nabrahConfigured()) return { configured: false, agents: [] };
    try {
      const agents = await nabrah.listAgents();
      return {
        configured: true,
        agents: agents.map((a) => ({ id: a.agent_id, name: a.name, updatedAt: a.last_update ?? null })),
      };
    } catch (e) {
      return { configured: true, agents: [], error: (e as Error).message };
    }
  });

/**
 * Points the linked Nabrah agent's post-call callbacks at this company's
 * webhook so finished calls flow back into the dashboard automatically.
 */
export const syncNabrahCallbacks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const { data: agent } = await context.supabase
      .from("ai_agents").select("id, provider_agent_id")
      .eq("company_id", data.companyId).eq("channel", "voice").limit(1).maybeSingle();
    if (!agent?.provider_agent_id) return { ok: false, reason: "no_linked_agent" };
    const nabrah = await import("./nabrah.server");
    const url = nabrah.agentWebhookUrl(agent.id);
    try {
      await nabrah.updateAgent(agent.provider_agent_id, {
        post_call_callback: { url },
        post_analysis_callback: { url },
      });
      return { ok: true, reason: null };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  });

/** Pulls recent Nabrah calls for this company's linked agents into voice_calls. */
export const syncNabrahCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r) throw new Error("Forbidden");

    const { data: agents } = await context.supabase
      .from("ai_agents").select("id, provider_agent_id")
      .eq("company_id", data.companyId).eq("channel", "voice");
    const byProvider = new Map<string, string>();
    for (const a of agents ?? []) if (a.provider_agent_id) byProvider.set(a.provider_agent_id, a.id);
    if (byProvider.size === 0) return { imported: 0, updated: 0, reason: "no_linked_agent" };

    const nabrah = await import("./nabrah.server");
    if (!nabrah.nabrahConfigured()) return { imported: 0, updated: 0, reason: "not_configured" };

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    let list;
    try {
      list = await nabrah.searchCalls({ limit: 100, offset: 0, created_at_start: since });
    } catch (e) {
      return { imported: 0, updated: 0, reason: (e as Error).message };
    }
    const mine = list.calls.filter((c) => byProvider.has(c.agent_id));
    if (mine.length === 0) return { imported: 0, updated: 0, reason: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("voice_calls").select("id, provider_call_id, transcript")
      .eq("company_id", data.companyId)
      .in("provider_call_id", mine.map((c) => c.id));
    const known = new Map((existing ?? []).map((row) => [row.provider_call_id as string, row]));

    let imported = 0;
    let updated = 0;
    for (const c of mine) {
      const row = known.get(c.id);
      if (row && row.transcript) continue;

      let detail: Awaited<ReturnType<typeof nabrah.getCall>> | null = null;
      try {
        detail = await nabrah.getCall(c.id);
      } catch {
        detail = null;
      }
      const recording = detail?.recording_file ? await nabrah.getRecordingLink(c.id) : null;
      const payload = {
        company_id: data.companyId,
        agent_id: byProvider.get(c.agent_id)!,
        provider: "nabrah",
        provider_call_id: c.id,
        direction: c.call_type === "outbound" ? "outbound" : "inbound",
        call_type: c.call_type,
        from_number: c.call_from && c.call_from !== "_" ? c.call_from : null,
        to_number: c.call_to && c.call_to !== "_" ? c.call_to : null,
        status: c.status === "completed" ? "completed" : c.status,
        duration_seconds: c.duration ?? 0,
        recording_url: recording,
        transcript: (detail?.transcript ?? null) as unknown as never,
        analysis: (detail?.analysis_results ?? null) as unknown as never,
        started_at: c.call_started_at ?? c.created_at,
        ended_at: c.call_ended_at ?? null,
        synced_at: new Date().toISOString(),
      };
      if (row) {
        await supabaseAdmin.from("voice_calls").update(payload).eq("id", row.id);
        updated += 1;
      } else {
        const { error } = await supabaseAdmin.from("voice_calls").insert(payload);
        if (!error) imported += 1;
      }
    }
    return { imported, updated, reason: null };
  });

const callSchema = z.object({ companyId: z.string().uuid(), callId: z.string().uuid() });

/** Fetches transcript + fresh recording link for one stored call. */
export const getNabrahCallDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => callSchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r) throw new Error("Forbidden");
    const { data: row } = await context.supabase
      .from("voice_calls").select("id, provider_call_id, transcript, analysis")
      .eq("id", data.callId).eq("company_id", data.companyId).maybeSingle();
    if (!row) throw new Error("not_found");
    if (!row.provider_call_id) return { transcript: row.transcript ?? null, recordingUrl: null };

    const nabrah = await import("./nabrah.server");
    if (!nabrah.nabrahConfigured()) return { transcript: row.transcript ?? null, recordingUrl: null };
    try {
      const detail = await nabrah.getCall(row.provider_call_id);
      const recordingUrl = detail.recording_file ? await nabrah.getRecordingLink(row.provider_call_id) : null;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("voice_calls").update({
        transcript: (detail.transcript ?? null) as unknown as never,
        analysis: (detail.analysis_results ?? null) as unknown as never,
        recording_url: recordingUrl,
        synced_at: new Date().toISOString(),
      }).eq("id", row.id);
      return { transcript: (detail.transcript ?? null) as unknown, recordingUrl };
    } catch {
      return { transcript: row.transcript ?? null, recordingUrl: null };
    }
  });

