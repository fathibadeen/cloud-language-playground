import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const saveSchema = z.object({
  companyId: z.string().uuid(),
  scope: z.enum(["sip", "whatsapp", "voice_provider", "payment"]),
  provider: z.string().min(1),
  referenceId: z.string().uuid().nullable().optional(),
  secrets: z.record(z.string(), z.string()),
});

/**
 * Stores provider credentials (SIP passwords, WhatsApp tokens, ...) server-side.
 * The provider_credentials table has no anon/authenticated grants, so secrets
 * can never be read from the browser.
 */
export const saveProviderCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Verify the caller administers this company (RLS-scoped client).
    const { data: membership, error: mErr } = await context.supabase
      .from("company_members")
      .select("role")
      .eq("company_id", data.companyId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("provider_credentials").insert({
      company_id: data.companyId,
      scope: data.scope,
      provider: data.provider,
      reference_id: data.referenceId ?? null,
      secret_payload: data.secrets,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "credentials.saved",
      entity: data.scope,
      metadata: { provider: data.provider },
    });

    return { ok: true };
  });

const testSchema = z.object({
  companyId: z.string().uuid(),
  scope: z.enum(["sip", "whatsapp", "voice_provider"]),
});

/**
 * Checks whether the external provider is actually reachable. No provider
 * integration is configured yet, so this reports an honest "not connected"
 * state instead of faking a successful integration.
 */
export const testProviderConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => testSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("provider_credentials")
      .select("id, provider")
      .eq("company_id", data.companyId)
      .eq("scope", data.scope)
      .limit(1);

    const hasCredentials = (rows ?? []).length > 0;
    const apiKey =
      data.scope === "whatsapp" ? process.env["WHATSAPP_API_KEY"] : process.env["NABRAH_API_KEY"];

    void context.userId;

    if (!hasCredentials) {
      return { status: "not_connected" as const, reason: "missing_credentials" };
    }
    if (!apiKey) {
      return { status: "not_connected" as const, reason: "missing_platform_api_key" };
    }
    return { status: "testing" as const, reason: "provider_integration_pending" };
  });
