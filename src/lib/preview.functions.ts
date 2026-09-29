import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  companyId: z.string().uuid(),
  agentId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

/**
 * Sandbox reply used by the in-dashboard agent tester (voice + WhatsApp).
 * It answers with the same instructions and company knowledge the live agent
 * uses, but never touches the customer's real channel.
 */
export const previewAgentReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("company_members").select("role")
      .eq("company_id", data.companyId).eq("user_id", context.userId).maybeSingle();
    if (!member) throw new Error("Forbidden");

    const { data: agent } = await context.supabase
      .from("ai_agents")
      .select("name, channel, language, personality, system_instructions, greeting, fallback_response")
      .eq("id", data.agentId).eq("company_id", data.companyId).maybeSingle();
    if (!agent) return { ok: false as const, reason: "agent_not_found", reply: null, sources: [] as string[] };

    const { data: company } = await context.supabase
      .from("companies").select("name, description, city, contact_phone, working_hours")
      .eq("id", data.companyId).maybeSingle();

    const { data: chunks } = await context.supabase
      .from("knowledge_chunks").select("content")
      .eq("company_id", data.companyId).limit(40);
    const knowledge = (chunks ?? []).map((c) => String(c.content)).join("\n---\n").slice(0, 12000);

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, reason: "ai_not_configured", reply: null, sources: [] as string[] };

    const system = [
      `أنت "${agent.name}"، ${agent.channel === "whatsapp" ? "وكيل واتساب" : "وكيل مكالمات"} لشركة ${company?.name ?? ""}.`,
      agent.personality ? `الشخصية: ${agent.personality}` : "",
      agent.system_instructions ? `التعليمات: ${agent.system_instructions}` : "",
      agent.greeting ? `التحية: ${agent.greeting}` : "",
      company?.description ? `عن الشركة: ${company.description}` : "",
      company?.city ? `المدينة: ${company.city}` : "",
      knowledge ? `قاعدة المعرفة (اعتمد عليها حصراً للحقائق):\n${knowledge}` : "لا توجد قاعدة معرفة بعد.",
      `إن لم تجد الإجابة في قاعدة المعرفة فقل: ${agent.fallback_response ?? "سأحوّلك إلى موظف مختص."}`,
      agent.language === "en" ? "Reply in English." : "أجب بالعربية وبإيجاز.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: system }, ...data.messages],
        }),
      });
      if (res.status === 429) return { ok: false as const, reason: "rate_limited", reply: null, sources: [] as string[] };
      if (res.status === 402) return { ok: false as const, reason: "credits_required", reply: null, sources: [] as string[] };
      if (!res.ok) return { ok: false as const, reason: `ai_error_${res.status}`, reply: null, sources: [] as string[] };
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = json.choices?.[0]?.message?.content ?? "";
      return {
        ok: true as const,
        reason: null,
        reply,
        sources: knowledge ? ["knowledge_base"] : [],
      };
    } catch (e) {
      return { ok: false as const, reason: (e as Error).message, reply: null, sources: [] as string[] };
    }
  });
