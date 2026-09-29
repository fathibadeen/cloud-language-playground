import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const companySchema = z.object({ companyId: z.string().uuid() });

const CALL_STATUSES = ["completed", "failed", "in_progress", "ringing", "transferred"] as const;
type CallStatus = (typeof CALL_STATUSES)[number];
function mapStatus(s: string): CallStatus {
  if ((CALL_STATUSES as readonly string[]).includes(s)) return s as CallStatus;
  if (s === "queued" || s === "ongoing" || s === "in-progress") return "in_progress";
  return "failed";
}
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
        status: mapStatus(c.status),
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

type TranscriptLine = { role: string; text: string };

function normalizeTranscript(raw: unknown): TranscriptLine[] {
  if (!Array.isArray(raw)) return [];
  const out: TranscriptLine[] = [];
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>;
    const text = String(o["content"] ?? o["text"] ?? o["message"] ?? "").trim();
    if (!text) continue;
    const who = String(o["role"] ?? o["speaker"] ?? o["source"] ?? "").toLowerCase();
    out.push({ role: who.includes("agent") || who.includes("assistant") ? "agent" : "customer", text });
  }
  return out;
}

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
    const stored = normalizeTranscript(row.transcript);
    if (!row.provider_call_id) return { transcript: stored, recordingUrl: null };

    const nabrah = await import("./nabrah.server");
    if (!nabrah.nabrahConfigured()) return { transcript: stored, recordingUrl: null };
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
      return { transcript: normalizeTranscript(detail.transcript), recordingUrl };
    } catch {
      return { transcript: stored, recordingUrl: null };
    }
  });


async function linkedVoiceAgent(supabase: any, companyId: string) {
  const { data } = await supabase
    .from("ai_agents").select("id, provider_agent_id")
    .eq("company_id", companyId).eq("channel", "voice").limit(1).maybeSingle();
  return data as { id: string; provider_agent_id: string | null } | null;
}

/** Lists Nabrah SIP inbound lines so an admin can link one to the company agent. */
export const listNabrahSipLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const nabrah = await import("./nabrah.server");
    if (!nabrah.nabrahConfigured()) return { lines: [] as { id: string; name: string; numbers: string }[], error: "not_configured" };
    try {
      const res = await nabrah.listSipInbound();
      const items = Array.isArray(res) ? res : (res?.items ?? []);
      return {
        lines: items.map((l: { id: string; name: string; numbers: string }) => ({ id: String(l.id), name: String(l.name ?? ""), numbers: String(l.numbers ?? "") })),
        error: null as string | null,
      };
    } catch (e) {
      return { lines: [], error: (e as Error).message };
    }
  });

export const linkNabrahSipLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.extend({ inboundId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const agent = await linkedVoiceAgent(context.supabase, data.companyId);
    if (!agent?.provider_agent_id) return { ok: false, reason: "no_linked_agent" };
    const nabrah = await import("./nabrah.server");
    try {
      await nabrah.linkAgentToInbound(agent.provider_agent_id, data.inboundId);
      return { ok: true, reason: null as string | null };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  });

/** Starts an outbound call from the company's Nabrah agent. Checks role and monthly minutes. */
export const makeNabrahCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companySchema.extend({
      to: z.string().trim().regex(/^\+?[0-9]{8,15}$/),
      from: z.string().trim().regex(/^\+?[0-9]{8,15}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin", "agent"].includes(r)) throw new Error("Forbidden");
    const { data: active } = await context.supabase.rpc("company_is_active", { _company_id: data.companyId });
    if (active === false) return { ok: false, reason: "company_inactive" };
    const { data: limit } = await context.supabase.rpc("company_limit", { _company_id: data.companyId, _key: "voice_minutes" });
    const { data: used } = await context.supabase.rpc("company_usage_this_month", { _company_id: data.companyId, _metric: "voice_minutes" });
    if (typeof limit === "number" && limit > 0 && Number(used ?? 0) >= limit) return { ok: false, reason: "minutes_exhausted" };
    const agent = await linkedVoiceAgent(context.supabase, data.companyId);
    if (!agent?.provider_agent_id) return { ok: false, reason: "no_linked_agent" };
    const nabrah = await import("./nabrah.server");
    try {
      await nabrah.makeCall({ agent_id: agent.provider_agent_id, call_from: data.from, call_to: data.to });
      return { ok: true, reason: null as string | null };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  });

/** Re-uploads every ready knowledge document of the company to its Nabrah knowledge base. */
export const syncCompanyKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const nabrah = await import("./nabrah.server");
    if (!nabrah.nabrahConfigured()) return { ok: false, synced: 0, reason: "not_configured" as string | null };

    const { data: company } = await context.supabase
      .from("companies").select("name").eq("id", data.companyId).maybeSingle();
    const { data: docs } = await context.supabase
      .from("knowledge_documents").select("title, content, status")
      .eq("company_id", data.companyId).eq("status", "ready");
    const ready = (docs ?? []).filter((d) => (d.content ?? "").trim().length > 0);
    if (ready.length === 0) return { ok: false, synced: 0, reason: "no_documents" as string | null };

    try {
      const kb = await nabrah.ensureCompanyKb(data.companyId, company?.name ?? "Sawti");
      const text = ready.map((d) => `# ${d.title}\n${d.content}`).join("\n\n").slice(0, 50000);
      try {
        await nabrah.addTextDocument(kb.id, text);
      } catch (e) {
        if (nabrah.isUnsupported(e)) {
          return { ok: false, synced: 0, reason: nabrah.NABRAH_READ_ONLY as string | null };
        }
        throw e;
      }
      const agent = await linkedVoiceAgent(context.supabase, data.companyId);
      if (agent?.provider_agent_id) {
        try {
          await nabrah.updateAgent(agent.provider_agent_id, { support_data: text.slice(0, 10000) });
        } catch { /* agent update is best-effort */ }
      }
      return { ok: true, synced: ready.length, reason: null as string | null };
    } catch (e) {
      return { ok: false, synced: 0, reason: (e as Error).message as string | null };
    }
  });

/** Deletes every document Sawti pushed to the company's Nabrah knowledge base. */
export const clearNabrahKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const nabrah = await import("./nabrah.server");
    if (!nabrah.nabrahConfigured()) return { ok: false, deleted: 0, reason: "not_configured" as string | null };
    const { data: company } = await context.supabase
      .from("companies").select("name").eq("id", data.companyId).maybeSingle();
    try {
      const kb = await nabrah.ensureCompanyKb(data.companyId, company?.name ?? "Sawti");
      const docs = await nabrah.listKbDocuments(kb.id);
      let deleted = 0;
      for (const d of docs) {
        try { await nabrah.deleteDocument(String(d.id)); deleted += 1; } catch { /* keep going */ }
      }
      return { ok: true, deleted, reason: null as string | null };
    } catch (e) {
      return { ok: false, deleted: 0, reason: (e as Error).message as string | null };
    }
  });

/** Refreshes linked agent names/status from Nabrah and flags links that disappeared. */
export const syncNabrahAgentMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const nabrah = await import("./nabrah.server");
    if (!nabrah.nabrahConfigured()) return { checked: 0, missing: 0, reason: "not_configured" as string | null };
    const { data: agents } = await context.supabase
      .from("ai_agents").select("id, provider_agent_id").eq("company_id", data.companyId)
      .not("provider_agent_id", "is", null);
    const rows = agents ?? [];
    if (rows.length === 0) return { checked: 0, missing: 0, reason: "no_linked_agent" as string | null };

    let remote: { agent_id: string; name: string }[] = [];
    try {
      remote = await nabrah.listAgents();
    } catch (e) {
      return { checked: 0, missing: 0, reason: (e as Error).message as string | null };
    }
    const ids = new Set(remote.map((a) => a.agent_id));
    let missing = 0;
    for (const row of rows) {
      const ok = ids.has(String(row.provider_agent_id));
      if (!ok) missing += 1;
      await context.supabase.from("ai_agents").update({
        provider_status: ok ? "connected" : "error",
        provider_error: ok ? null : "agent_missing_in_nabrah",
      }).eq("id", row.id).eq("company_id", data.companyId);
    }
    return { checked: rows.length, missing, reason: null as string | null };
  });

/** Removes the Nabrah link from a platform agent (the Nabrah agent itself is kept). */
export const unlinkNabrahAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.extend({ agentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const { error } = await context.supabase.from("ai_agents").update({
      provider_agent_id: null,
      direct_link: null,
      provider_status: "not_connected",
      provider_error: null,
    }).eq("id", data.agentId).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Imports Nabrah SIP inbound numbers into phone_numbers so they appear locally. */
export const syncNabrahNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const nabrah = await import("./nabrah.server");
    if (!nabrah.nabrahConfigured()) return { imported: 0, reason: "not_configured" as string | null };
    let items: { id: string; name: string; numbers: string }[] = [];
    try {
      const res = await nabrah.listSipInbound();
      items = (Array.isArray(res) ? res : (res?.items ?? [])) as typeof items;
    } catch (e) {
      return { imported: 0, reason: (e as Error).message as string | null };
    }
    const numbers = items
      .flatMap((l) => String(l.numbers ?? "").split(/[,\s]+/))
      .map((n) => n.trim())
      .filter((n) => /^\+?[0-9]{8,15}$/.test(n));
    if (numbers.length === 0) return { imported: 0, reason: "no_numbers" as string | null };

    const agent = await linkedVoiceAgent(context.supabase, data.companyId);
    const { data: existing } = await context.supabase
      .from("phone_numbers").select("phone_number").eq("company_id", data.companyId);
    const known = new Set((existing ?? []).map((p) => String(p.phone_number)));
    let imported = 0;
    for (const n of numbers) {
      if (known.has(n)) continue;
      const { error } = await context.supabase.from("phone_numbers").insert({
        company_id: data.companyId,
        phone_number: n,
        country: "SA",
        provider: "nabrah",
        sip_status: "connected",
        provider_status: "connected",
        agent_id: agent?.id ?? null,
      });
      if (!error) imported += 1;
    }
    return { imported, reason: null as string | null };
  });

/** Detaches a Nabrah SIP inbound line from the company's voice agent. */
export const unlinkNabrahSipLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.extend({ inboundId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r || !["owner", "admin"].includes(r)) throw new Error("Forbidden");
    const agent = await linkedVoiceAgent(context.supabase, data.companyId);
    if (!agent?.provider_agent_id) return { ok: false, reason: "no_linked_agent" as string | null };
    const nabrah = await import("./nabrah.server");
    try {
      await nabrah.unlinkAgentFromInbound(agent.provider_agent_id, data.inboundId);
      return { ok: true, reason: null as string | null };
    } catch (e) {
      return { ok: false, reason: (e as Error).message as string | null };
    }
  });
