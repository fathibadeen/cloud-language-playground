import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const companySchema = z.object({ companyId: z.string().uuid() });

const METRICS = [
  { metric: "voice_minutes", key: "voice_minutes", ar: "دقائق المكالمات" },
  { metric: "whatsapp_messages", key: "whatsapp_messages", ar: "رسائل واتساب" },
] as const;

/**
 * Creates in-app notifications when the company crosses 80% / 100% of a plan
 * limit. Safe to call on every dashboard load: one notification per threshold
 * per month, deduplicated by the notification type key.
 */
export const checkUsageAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("company_members").select("role")
      .eq("company_id", data.companyId).eq("user_id", context.userId).maybeSingle();
    if (!member) throw new Error("Forbidden");

    const month = new Date().toISOString().slice(0, 7);
    const created: string[] = [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (const m of METRICS) {
      const { data: limit } = await context.supabase
        .rpc("company_limit", { _company_id: data.companyId, _key: m.key });
      if (typeof limit !== "number" || limit <= 0) continue;
      const { data: used } = await context.supabase
        .rpc("company_usage_this_month", { _company_id: data.companyId, _metric: m.metric });
      const pct = (Number(used ?? 0) / limit) * 100;
      const level = pct >= 100 ? 100 : pct >= 80 ? 80 : null;
      if (!level) continue;

      const type = `usage_${m.metric}_${level}_${month}`;
      const { data: exists } = await supabaseAdmin
        .from("notifications").select("id")
        .eq("company_id", data.companyId).eq("type", type).maybeSingle();
      if (exists) continue;

      await supabaseAdmin.from("notifications").insert({
        company_id: data.companyId,
        title: level === 100 ? `انتهت ${m.ar} لهذا الشهر` : `اقتربت من حد ${m.ar}`,
        body:
          level === 100
            ? `استهلكت كامل ${m.ar} في باقتك. رقّ باقتك لمواصلة الخدمة.`
            : `استهلكت ${Math.round(pct)}% من ${m.ar} في باقتك.`,
        type,
      });
      created.push(type);
    }
    return { created: created.length };
  });

/** Records an operational notification for the company (welcome, channel events). */
export const notifyCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companySchema
      .extend({
        title: z.string().trim().min(1).max(160),
        body: z.string().trim().max(500).optional(),
        type: z.string().trim().min(1).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("company_members").select("role")
      .eq("company_id", data.companyId).eq("user_id", context.userId).maybeSingle();
    if (!member || !["owner", "admin"].includes(String(member.role))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      company_id: data.companyId,
      title: data.title,
      body: data.body ?? null,
      type: data.type,
    });
    return { ok: true };
  });

/** Exports every record the company owns as one JSON document. */
export const exportCompanyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("company_members").select("role")
      .eq("company_id", data.companyId).eq("user_id", context.userId).maybeSingle();
    if (!member || !["owner", "admin"].includes(String(member.role))) throw new Error("Forbidden");

    const tables = [
      "companies",
      "ai_agents",
      "phone_numbers",
      "whatsapp_accounts",
      "knowledge_bases",
      "knowledge_documents",
      "conversations",
      "messages",
      "voice_calls",
      "customers",
      "usage_records",
      "billing_records",
      "company_members",
    ] as const;

    const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
    for (const table of tables) {
      const column = table === "companies" ? "id" : "company_id";
      const query = context.supabase.from(table).select("*") as unknown as {
        eq: (c: string, v: string) => { limit: (n: number) => Promise<{ data: unknown[] | null }> };
      };
      const { data: rows } = await query.eq(column, data.companyId).limit(2000);
      out[table] = rows ?? [];
    }
    return { json: JSON.stringify(out, null, 2) };
  });


/** Owner-initiated account closure: suspends the company and logs the request. */
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    companySchema.extend({ reason: z.string().trim().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("company_members").select("role")
      .eq("company_id", data.companyId).eq("user_id", context.userId).maybeSingle();
    if (!member || String(member.role) !== "owner") throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("companies").update({ status: "suspended" }).eq("id", data.companyId);
    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "account_deletion_requested",
      entity: "companies",
      entity_id: data.companyId,
      metadata: { reason: data.reason ?? null },
    });
    await supabaseAdmin.from("notifications").insert({
      company_id: data.companyId,
      title: "تم استلام طلب إغلاق الحساب",
      body: "أُوقف الحساب مؤقتًا وسنحذف البيانات خلال 14 يومًا ما لم تتراجع.",
      type: "account_deletion",
    });
    return { ok: true };
  });
