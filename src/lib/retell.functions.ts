import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const companySchema = z.object({ companyId: z.string().uuid() });

async function assertAdmin(
  supabase: { from: (t: string) => any },
  companyId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !["owner", "admin"].includes(data.role)) throw new Error("Forbidden");
}

function webhookUrl(): string {
  const configured = process.env["RETELL_WEBHOOK_URL"];
  if (configured) return configured;
  const origin = new URL(getRequest().url).origin;
  return `${origin}/api/public/webhooks/retell`;
}

/**
 * Creates (or repairs) the Retell LLM + agent + phone number for a company.
 * Idempotent: an agent that already has a provider_agent_id is only updated.
 */
export const provisionCompanyVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, data.companyId, context.userId);

    if (!process.env["RETELL_API_KEY"]) {
      return { status: "not_connected" as const, reason: "missing_platform_api_key" };
    }

    const retell = await import("./retell.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, industry, description, default_locale")
      .eq("id", data.companyId)
      .single();
    if (!company) throw new Error("company_not_found");

    const { data: agents } = await supabaseAdmin
      .from("ai_agents")
      .select("*")
      .eq("company_id", data.companyId)
      .eq("channel", "voice");

    const voiceAgent = (agents ?? [])[0];
    if (!voiceAgent) return { status: "not_connected" as const, reason: "no_voice_agent" };

    const { data: docs } = await supabaseAdmin
      .from("knowledge_documents")
      .select("title, content")
      .eq("company_id", data.companyId)
      .limit(10);
    const knowledge = (docs ?? [])
      .map((d) => [d.title, d.content].filter(Boolean).join("\n"))
      .join("\n\n")
      .slice(0, 5000);

    const language = (voiceAgent.language ?? company.default_locale ?? "ar") as "ar" | "en";
    const greeting =
      voiceAgent.greeting ||
      (language === "ar"
        ? `مرحبًا بك في ${company.name}، كيف أقدر أخدمك؟`
        : `Welcome to ${company.name}, how can I help you?`);

    const prompt = retell.buildPrompt({
      companyName: company.name,
      industry: company.industry,
      description: company.description,
      personality: voiceAgent.personality,
      instructions: voiceAgent.system_instructions,
      knowledge,
      language,
    });

    try {
      let llmId = voiceAgent.provider_llm_id as string | null;
      let agentId = voiceAgent.provider_agent_id as string | null;

      if (llmId && agentId) {
        await retell.updateLlm(llmId, prompt, greeting);
      } else {
        const llm = await retell.createLlm({ prompt, greeting });
        llmId = llm.llm_id;
        const voiceId = await retell.pickVoice(language);
        const created = await retell.createAgent({
          name: `${company.name} — ${voiceAgent.name}`,
          llmId,
          voiceId,
          language,
          webhookUrl: webhookUrl(),
        });
        agentId = created.agent_id;
      }

      await supabaseAdmin
        .from("ai_agents")
        .update({
          provider: "retell",
          provider_llm_id: llmId,
          provider_agent_id: agentId,
          provider_status: "connected",
          provider_error: null,
          greeting,
        })
        .eq("id", voiceAgent.id);

      // Reserve a phone number once per company.
      const { data: existingNumbers } = await supabaseAdmin
        .from("phone_numbers")
        .select("id")
        .eq("company_id", data.companyId)
        .limit(1);

      let phoneNumber: string | null = null;
      if ((existingNumbers ?? []).length === 0) {
        try {
          const bought = await retell.buyPhoneNumber({ agentId: agentId! });
          phoneNumber = bought.phone_number;
          await supabaseAdmin.from("phone_numbers").insert({
            company_id: data.companyId,
            phone_number: bought.phone_number,
            country: "US",
            provider: "retell",
            sip_status: "connected",
            provider_status: "connected",
            agent_id: voiceAgent.id,
            is_active: true,
          });
        } catch (err) {
          await supabaseAdmin
            .from("ai_agents")
            .update({ provider_error: err instanceof Error ? err.message : String(err) })
            .eq("id", voiceAgent.id);
          return {
            status: "partial" as const,
            reason: "number_not_provisioned",
            agentId,
            phoneNumber: null,
          };
        }
      }

      await supabaseAdmin.from("audit_logs").insert({
        company_id: data.companyId,
        user_id: context.userId,
        action: "retell.provisioned",
        entity: "ai_agent",
        entity_id: voiceAgent.id,
        metadata: { agentId, phoneNumber },
      });

      return { status: "connected" as const, agentId, phoneNumber };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("ai_agents")
        .update({ provider_status: "error", provider_error: message })
        .eq("id", voiceAgent.id);
      return { status: "error" as const, reason: message };
    }
  });

/** Honest connection status for the voice page. */
export const retellStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: membership } = await context.supabase
      .from("company_members")
      .select("role")
      .eq("company_id", data.companyId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!membership) throw new Error("Forbidden");

    if (!process.env["RETELL_API_KEY"]) {
      return { status: "not_connected" as const, reason: "missing_platform_api_key" };
    }

    const { data: agent } = await supabaseAdmin
      .from("ai_agents")
      .select("provider_agent_id, provider_status, provider_error")
      .eq("company_id", data.companyId)
      .eq("channel", "voice")
      .maybeSingle();

    try {
      const retell = await import("./retell.server");
      await retell.ping();
    } catch (err) {
      return {
        status: "error" as const,
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    if (!agent?.provider_agent_id) {
      return { status: "pending" as const, reason: agent?.provider_error ?? "not_provisioned" };
    }
    return { status: "connected" as const, agentId: agent.provider_agent_id };
  });

/** Pulls recent Retell calls for this company's agents into the platform. */
export const syncRetellCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, data.companyId, context.userId);
    if (!process.env["RETELL_API_KEY"]) {
      return { imported: 0, reason: "missing_platform_api_key" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agents } = await supabaseAdmin
      .from("ai_agents")
      .select("provider_agent_id")
      .eq("company_id", data.companyId)
      .not("provider_agent_id", "is", null);

    const ids = (agents ?? []).map((a) => a.provider_agent_id!).filter(Boolean);
    if (ids.length === 0) return { imported: 0, reason: "not_provisioned" };

    const retell = await import("./retell.server");
    const { ingestRetellCall } = await import("./retell-ingest.server");
    const calls = await retell.listCalls(ids, 100);

    let imported = 0;
    for (const c of calls) {
      const res = await ingestRetellCall(c);
      if (res.ok) imported += 1;
    }
    return { imported };
  });
