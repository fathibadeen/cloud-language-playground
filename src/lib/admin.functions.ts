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

    const [companies, subs, plans, agents, calls, conversations, webhooks] = await Promise.all([
      supabaseAdmin.from("companies").select("id, name, status, created_at, city, industry"),
      supabaseAdmin.from("subscriptions").select("id, status, plan_id, company_id, current_period_end, created_at, plans(id, name_ar, name_en, price_sar)").order("created_at", { ascending: false }),
      supabaseAdmin.from("plans").select("id, code, name_ar, name_en, price_sar, is_active").eq("is_active", true).order("sort_order"),
      supabaseAdmin.from("ai_agents").select("id, is_active, company_id, provider_agent_id"),
      supabaseAdmin.from("voice_calls").select("id, duration_seconds"),
      supabaseAdmin.from("conversations").select("id, channel"),
      supabaseAdmin.from("webhook_events").select("id, status, provider, created_at").limit(50),
    ]);

    const companyRows = companies.data ?? [];
    const subRows = (subs.data ?? []) as { status: string; plans: { price_sar: number } | null }[];

    return {
      companies: companyRows,
      subscriptions: subs.data ?? [],
      plans: plans.data ?? [],
      totals: {
        companies: companyRows.length,
        activeCompanies: companyRows.filter((c) => c.status === "active").length,
        subscriptions: subRows.filter((s) => s.status === "active" || s.status === "trialing").length,
        revenue: subRows
          .filter((s) => s.status === "active")
          .reduce((sum, s) => sum + Number(s.plans?.price_sar ?? 0), 0),
        activeAgents: (agents.data ?? []).filter((a) => a.is_active).length,
        minutes: Math.round(
          (calls.data ?? []).reduce((s, c) => s + (c.duration_seconds ?? 0), 0) / 60,
        ),
        whatsappConversations: (conversations.data ?? []).filter((c) => c.channel === "whatsapp").length,
        webhookErrors: (webhooks.data ?? []).filter((w) => w.status === "failed").length,
      },
      webhooks: webhooks.data ?? [],
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
