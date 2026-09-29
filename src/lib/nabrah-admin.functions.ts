import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Nabrah agent assignment is a platform-admin duty: the Nabrah account is shared
 * across all tenants, so companies must never see (or pick from) the full agent
 * list. These functions are super-admin only and keep one Nabrah agent bound to
 * at most one company.
 */

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_super_admin");
  if (data !== true) throw new Error("Forbidden");
}

const companySchema = z.object({ companyId: z.string().uuid() });

/** Lists every Nabrah agent with the company it is already assigned to. */
export const adminNabrahOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nabrah = await import("./nabrah.server");

    const { data: links } = await supabaseAdmin
      .from("ai_agents")
      .select("id, name, company_id, provider_agent_id, direct_link, companies(name)")
      .not("provider_agent_id", "is", null);

    const assignments = new Map<string, { companyId: string; companyName: string }>();
    for (const row of links ?? []) {
      const pid = row.provider_agent_id as string | null;
      if (!pid) continue;
      assignments.set(pid, {
        companyId: row.company_id as string,
        companyName: ((row as any).companies?.name as string) ?? "—",
      });
    }

    const { data: companyAgents } = await supabaseAdmin
      .from("ai_agents")
      .select("id, name, channel, provider_agent_id, direct_link, provider_status")
      .eq("company_id", data.companyId)
      .eq("channel", "voice")
      .order("created_at");

    let remote: { id: string; name: string }[] = [];
    let error: string | null = null;
    if (nabrah.nabrahConfigured()) {
      try {
        remote = (await nabrah.listAgents()).map((a) => ({ id: a.agent_id, name: a.name }));
      } catch (e) {
        error = (e as Error).message;
      }
    } else {
      error = "not_configured";
    }

    return {
      error,
      companyAgents: companyAgents ?? [],
      nabrahAgents: remote.map((a) => {
        const taken = assignments.get(a.id);
        return {
          id: a.id,
          name: a.name,
          assignedCompanyId: taken?.companyId ?? null,
          assignedCompanyName: taken?.companyName ?? null,
        };
      }),
    };
  });

const assignSchema = z.object({
  companyId: z.string().uuid(),
  agentId: z.string().uuid(),
  nabrahAgentId: z.string().trim().min(1).max(200),
  directLink: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u === "" || u.startsWith("https://"), "https_only")
    .optional()
    .default(""),
});

/** Assigns a Nabrah agent exclusively to one company and wires its callbacks. */
export const adminAssignNabrahAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nabrah = await import("./nabrah.server");

    const { data: conflict } = await supabaseAdmin
      .from("ai_agents")
      .select("id, company_id, companies(name)")
      .eq("provider_agent_id", data.nabrahAgentId)
      .neq("id", data.agentId)
      .maybeSingle();
    if (conflict) {
      return {
        ok: false,
        reason: "already_assigned" as const,
        companyName: ((conflict as any).companies?.name as string) ?? null,
      };
    }

    const { error } = await supabaseAdmin
      .from("ai_agents")
      .update({
        provider: "nabrah",
        provider_agent_id: data.nabrahAgentId,
        direct_link: data.directLink || null,
        provider_status: "connected",
        provider_error: null,
      })
      .eq("id", data.agentId)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);

    let webhook: string | null = null;
    try {
      const url = nabrah.agentWebhookUrl(data.agentId);
      await nabrah.updateAgent(data.nabrahAgentId, {
        post_call_callback: { url },
        post_analysis_callback: { url },
      });
      webhook = "ok";
    } catch (e) {
      webhook = (e as Error).message;
    }

    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "nabrah.agent_assigned",
      entity: "ai_agents",
      entity_id: data.agentId,
      metadata: { nabrah_agent_id: data.nabrahAgentId },
    });

    return { ok: true, reason: null, webhook, companyName: null as string | null };
  });

const unassignSchema = z.object({ companyId: z.string().uuid(), agentId: z.string().uuid() });

/** Removes the Nabrah link from a company's voice agent. */
export const adminUnassignNabrahAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unassignSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_agents")
      .update({
        provider_agent_id: null,
        direct_link: null,
        provider_status: "not_connected",
      })
      .eq("id", data.agentId)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "nabrah.agent_unassigned",
      entity: "ai_agents",
      entity_id: data.agentId,
      metadata: {},
    });
    return { ok: true };
  });
