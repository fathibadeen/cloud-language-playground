import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [companies, subs, plans, agents, calls, conversations, webhooks, requests, waAccounts, kbases, customerRows, docRows, waMessagesToday] =
      await Promise.all([
        supabaseAdmin.from("companies").select("id, name, status, created_at, city, industry, voice_enabled, whatsapp_enabled").order("created_at", { ascending: false }),
        supabaseAdmin
          .from("subscriptions")
          .select("id, status, plan_id, company_id, current_period_end, created_at, plans(id, name_ar, name_en, price_sar)")
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("plans").select("id, code, name_ar, name_en, price_sar, is_active").eq("is_active", true).order("sort_order"),
        supabaseAdmin.from("ai_agents").select("id, is_active, company_id, name, provider_agent_id, knowledge_base_id"),
        supabaseAdmin.from("voice_calls").select("id, duration_seconds"),
        supabaseAdmin.from("conversations").select("id, channel, company_id, created_at"),
        supabaseAdmin
          .from("webhook_events")
          .select("id, status, provider, created_at, company_id")
          .order("created_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("connection_requests")
          .select("id, company_id, channel, payload, status, admin_note, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("whatsapp_accounts")
          .select(
            "id, company_id, phone_number, phone_number_id, verified_name, business_account_id, status, agent_id, is_active, created_at",
          )
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("knowledge_bases").select("id, company_id, name"),
        supabaseAdmin.from("customers").select("company_id").limit(20000),
        supabaseAdmin.from("knowledge_documents").select("company_id").limit(20000),
        supabaseAdmin
          .from("messages")
          .select("company_id, channel, created_at")
          .eq("channel", "whatsapp")
          .gte("created_at", todayStart.toISOString())
          .limit(5000),
      ]);

    const companyRows = companies.data ?? [];
    const subRows = (subs.data ?? []) as { status: string; plans: { price_sar: number } | null }[];

    const countByCompany = (rows: { company_id: string | null }[]) => {
      const counts: Record<string, number> = {};
      for (const row of rows) if (row.company_id) counts[row.company_id] = (counts[row.company_id] ?? 0) + 1;
      return counts;
    };
    const waConversationsToday = (conversations.data ?? []).filter(
      (c) => c.channel === "whatsapp" && new Date(c.created_at).getTime() >= todayStart.getTime(),
    );

    const customerCounts = countByCompany(customerRows.data ?? []);
    const docCounts = countByCompany(docRows.data ?? []);
    const agentCounts = countByCompany(agents.data ?? []);
    const companyCounts: Record<string, { customers: number; documents: number; agents: number }> = {};
    for (const c of companyRows) {
      companyCounts[c.id] = { customers: customerCounts[c.id] ?? 0, documents: docCounts[c.id] ?? 0, agents: agentCounts[c.id] ?? 0 };
    }

    return {
      companyCounts,
      companies: companyRows,
      subscriptions: subs.data ?? [],
      plans: plans.data ?? [],
      agents: agents.data ?? [],
      whatsappAccounts: waAccounts.data ?? [],
      knowledgeBases: kbases.data ?? [],
      waStats: {
        messagesToday: (waMessagesToday.data ?? []).length,
        conversationsToday: waConversationsToday.length,
        messagesTodayByCompany: countByCompany(waMessagesToday.data ?? []),
        conversationsTodayByCompany: countByCompany(waConversationsToday),
      },
      totals: {
        companies: companyRows.length,
        activeCompanies: companyRows.filter((c) => c.status === "active").length,
        subscriptions: subRows.filter((s) => s.status === "active" || s.status === "trialing").length,
        revenue: subRows
          .filter((s) => s.status === "active")
          .reduce((sum, s) => sum + Number(s.plans?.price_sar ?? 0), 0),
        activeAgents: (agents.data ?? []).filter((a) => a.is_active).length,
        minutes: Math.round((calls.data ?? []).reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / 60),
        whatsappConversations: (conversations.data ?? []).filter((c) => c.channel === "whatsapp").length,
        webhookErrors: (webhooks.data ?? []).filter((w) => w.status === "failed").length,
      },
      webhooks: webhooks.data ?? [],
      connectionRequests: requests.data ?? [],
    };
  });

export const updateCompanySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      planId: z.string().uuid().nullable(),
      status: z.enum(["trialing", "active", "past_due", "canceled"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const payload = {
      plan_id: data.planId,
      status: data.status,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    };
    const result = existing
      ? await supabaseAdmin.from("subscriptions").update(payload).eq("id", existing.id)
      : await supabaseAdmin.from("subscriptions").insert({ company_id: data.companyId, ...payload });
    if (result.error) throw new Error(result.error.message);

    if (data.planId) {
      const { data: plan } = await supabaseAdmin.from("plans").select("product").eq("id", data.planId).maybeSingle();
      const product = plan?.product;
      if (product === "whatsapp" || product === "voice" || product === "bundle") {
        await supabaseAdmin
          .from("companies")
          .update({ voice_enabled: product !== "whatsapp", whatsapp_enabled: product !== "voice" })
          .eq("id", data.companyId);
      }
    }

    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "subscription.updated",
      entity: "subscriptions",
      metadata: { plan_id: data.planId, status: data.status },
    });
    return { ok: true };
  });

export const setCompanyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        status: z.enum(["active", "suspended", "pending"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ status: data.status })
      .eq("id", data.companyId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "company.status_changed",
      entity: "companies",
      entity_id: data.companyId,
      metadata: { status: data.status },
    });
    return { ok: true };
  });

export const reviewConnectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        action: z.enum(["approved", "rejected"]),
        note: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request, error: fetchError } = await supabaseAdmin
      .from("connection_requests")
      .select("id, company_id, channel, payload, status")
      .eq("id", data.requestId)
      .single();
    if (fetchError || !request) throw new Error("request_not_found");
    if (request.status !== "pending") throw new Error("request_already_reviewed");

    const { error } = await supabaseAdmin
      .from("connection_requests")
      .update({
        status: data.action,
        admin_note: data.note ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);

    // Real WhatsApp connection happens via Meta Embedded Signup
    // (completeWhatsappConnect) — approval here only records the decision.
    await supabaseAdmin.from("audit_logs").insert({
      company_id: request.company_id,
      user_id: context.userId,
      action: `connection_request.${data.action}`,
      entity: "connection_requests",
      entity_id: data.requestId,
      metadata: { channel: request.channel, note: data.note },
    });
    return { ok: true };
  });
