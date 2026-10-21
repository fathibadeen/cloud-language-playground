import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

function mask(v: string | null | undefined) {
  if (!v) return null;
  return "••••••••";
}

export const adminGetMoyasar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { loadMoyasarSettings } = await import("@/lib/moyasar.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await loadMoyasarSettings();
    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("id, amount_halalas, vat_halalas, status, applied, moyasar_invoice_id, moyasar_payment_id, created_at, companies(name), plans(name_ar, name_en)")
      .order("created_at", { ascending: false })
      .limit(200);
    return {
      settings: {
        publishable_key: s?.publishable_key ?? "",
        secret_key_set: mask(s?.secret_key),
        webhook_secret_set: mask(s?.webhook_secret),
        mode: (s?.mode ?? "test") as "test" | "live",
        enabled: s?.enabled ?? false,
      },
      payments: (payments ?? []) as any[],
    };
  });

export const adminSaveMoyasar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        publishable_key: z.string().trim().max(200),
        secret_key: z.string().trim().max(200).optional(),
        webhook_secret: z.string().trim().max(200).optional(),
        mode: z.enum(["test", "live"]),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row: Record<string, unknown> = {
      provider: "moyasar",
      publishable_key: data.publishable_key || null,
      mode: data.mode,
      enabled: data.enabled,
      updated_at: new Date().toISOString(),
    };
    if (data.secret_key) row["secret_key"] = data.secret_key;
    if (data.webhook_secret) row["webhook_secret"] = data.webhook_secret;
    const { error } = await supabaseAdmin.from("platform_payment_settings").upsert(row as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminTestMoyasar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { loadMoyasarSettings, moyasarRequest } = await import("@/lib/moyasar.server");
    const s = await loadMoyasarSettings();
    if (!s?.secret_key) return { ok: false, reason: "missing_key" };
    try {
      await moyasarRequest(s.secret_key, "/invoices?page=1");
      return { ok: true, reason: null };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  });

export const paymentsEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { loadMoyasarSettings } = await import("@/lib/moyasar.server");
    const s = await loadMoyasarSettings();
    return { enabled: !!(s?.enabled && s.secret_key), mode: s?.mode ?? "test" };
  });

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid(), planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: m } = await context.supabase
      .from("company_members")
      .select("role")
      .eq("company_id", data.companyId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!m || !["owner", "admin"].includes(m.role)) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadMoyasarSettings, moyasarRequest, VAT_RATE } = await import("@/lib/moyasar.server");
    const s = await loadMoyasarSettings();
    if (!s?.enabled || !s.secret_key) return { error: "payments_disabled" as const, url: null };

    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id, name_ar, price_sar, is_active")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || !plan.is_active || Number(plan.price_sar) <= 0) return { error: "invalid_plan" as const, url: null };

    const net = Math.round(Number(plan.price_sar) * 100);
    const vat = Math.round(net * VAT_RATE);
    const amount = net + vat;

    const { data: pay, error } = await supabaseAdmin
      .from("payments")
      .insert({ company_id: data.companyId, plan_id: plan.id, amount_halalas: amount, vat_halalas: vat, created_by: context.userId })
      .select("id")
      .single();
    if (error || !pay) throw new Error(error?.message ?? "insert_failed");

    const origin = new URL(getRequest().url).origin;
    try {
      const inv = await moyasarRequest<{ id: string; url: string }>(s.secret_key, "/invoices", {
        method: "POST",
        body: JSON.stringify({
          amount,
          currency: "SAR",
          description: `اشتراك صوتي — ${plan.name_ar} (شامل ضريبة 15%)`,
          success_url: `${origin}/dashboard/billing-callback?pid=${pay.id}`,
          back_url: `${origin}/dashboard/billing`,
          metadata: { payment_id: pay.id, company_id: data.companyId },
        }),
      });
      await supabaseAdmin.from("payments").update({ moyasar_invoice_id: inv.id }).eq("id", pay.id);
      return { error: null, url: inv.url };
    } catch (e) {
      await supabaseAdmin.from("payments").update({ status: "failed", raw: { error: (e as Error).message } as never }).eq("id", pay.id);
      return { error: "provider_error" as const, url: null };
    }
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS: caller can only read payments of their own companies.
    const { data: pay } = await context.supabase
      .from("payments")
      .select("id, moyasar_invoice_id")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!pay?.moyasar_invoice_id) return { status: "unknown" };
    const { applyInvoice } = await import("@/lib/moyasar.server");
    try {
      return await applyInvoice(pay.moyasar_invoice_id);
    } catch {
      return { status: "error" };
    }
  });
