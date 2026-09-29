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

/** Nabrah has no public call-list API; calls arrive through the webhook. */
export const syncNabrahCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await role(context.supabase as never, data.companyId, context.userId);
    if (!r) throw new Error("Forbidden");
    return { imported: 0, reason: "nabrah_calls_arrive_via_webhook" };
  });
