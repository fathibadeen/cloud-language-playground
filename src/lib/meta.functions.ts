/**
 * Admin-facing Meta WhatsApp functions (createServerFn wrappers).
 * Client code imports only this file; everything privileged lives in
 * meta.server.ts and is loaded inside handlers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  WHATSAPP_WEBHOOK_PATH,
  configureAppWebhook,
  deleteCompanyWhatsappToken,
  exchangeCodeForToken,
  exchangeLongLivedToken,
  fetchOwnedWabas,
  fetchWabaPhoneNumbers,
  loadCompanyWhatsappToken,
  metaConfigured,
  readPhoneNumber,
  saveCompanyWhatsappToken,
  subscribeWaba,
  unsubscribeWaba,
} from "@/lib/meta.server";

/** Super admin, or owner/admin of the company being connected. */
async function assertCanConnect(context: { supabase: any; userId: string }, companyId: string) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (isAdmin) return;
  const { data, error } = await context.supabase.rpc("has_company_role", { _company_id: companyId, _roles: ["owner", "admin"] });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

/** Any signed-in admin page can read whether Meta is configured + SDK params. */
export const getMetaConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const meta = await import("@/lib/meta.server");
    const env = meta.getMetaEnv();
    return {
      configured: metaConfigured(),
      appId: env.appId || null,
      configId: env.configId || null,
      graphVersion: env.graphVersion,
    };
  });

/**
 * Completes Embedded Signup for a company: code -> long-lived token ->
 * discover WABAs + phone numbers -> store account rows + encrypted token ->
 * register webhook subscriptions. Super admin only.
 */
export const completeWhatsappConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        code: z.string().min(10).max(2048),
        redirectUri: z.string().url().max(500).optional(),
        pageUrls: z.array(z.string().url().max(500)).max(5).optional(),
        wabaId: z.string().regex(/^\d{5,30}$/).optional(),
        phoneNumberId: z.string().regex(/^\d{5,30}$/).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCanConnect(context, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = await import("@/lib/meta.server");

    if (!metaConfigured()) throw new Error("meta_not_configured");

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .eq("id", data.companyId)
      .single();
    if (!company) throw new Error("company_not_found");

    const fail = (kind: string, detail?: string): never => {
      console.error("[meta connect]", kind, detail ?? "");
      throw new Error(detail ? `${kind}|${detail.slice(0, 300)}` : kind);
    };

    // 1) code -> token. Embedded Signup returns a business token that is
    //    already long-lived; the extra exchange is best effort.
    const short = await meta.exchangeCodeForToken(data.code, data.redirectUri, data.pageUrls ?? []);
    if (!short.ok) fail(short.error.kind, short.error.detail);
    let token = (short as { token: string }).token;
    let expiresIn: number | null = null;
    const long = await meta.exchangeLongLivedToken(token);
    if (long.ok) {
      token = long.token;
      expiresIn = long.expiresIn;
    }

    // 2) discover WABAs: ids sent by the signup popup, then debug_token
    //    granular scopes, then the owned-accounts edge as a last resort.
    const wabaIds = new Set<string>(data.wabaId ? [data.wabaId] : []);
    for (const id of await meta.fetchGrantedWabaIds(token)) wabaIds.add(id);
    const wabaList: { id: string; name?: string }[] = [];
    for (const id of wabaIds) {
      const info = await meta.readWaba(token, id);
      wabaList.push({ id, name: (info.ok ? info.data?.name : undefined) ?? "" });
    }
    if (wabaList.length === 0) {
      const owned = await meta.fetchOwnedWabas(token);
      if (owned.ok) wabaList.push(...(owned.data?.data ?? []));
    }
    if (wabaList.length === 0) {
      for (const w of await meta.fetchBusinessWabas(token)) wabaList.push(w);
    }
    if (wabaList.length === 0) {
      fail("meta_no_waba", await meta.describeToken(token));
    }

    // 3) register the app-level webhook (best effort, reported back)
    let webhookBase = "";
    try {
      webhookBase = new URL(meta.getMetaEnv().redirectUri).origin;
    } catch {
      webhookBase = "";
    }
    const webhook = webhookBase
      ? await meta.configureAppWebhook(`${webhookBase}${WHATSAPP_WEBHOOK_PATH}`)
      : ({ ok: false as const, error: { kind: "meta_webhook_error" as const } });
    let lastPhoneError: { kind: string; detail?: string } | null = null;

    const connected: {
      wabaId: string;
      wabaName: string;
      phoneNumber: string;
      phoneNumberId: string;
      verifiedName: string | null;
    }[] = [];

    for (const waba of wabaList) {
      const phones = await meta.fetchWabaPhoneNumbers(token, waba.id);
      if (!phones.ok) {
        lastPhoneError = phones.error;
        continue;
      }
      const numbers = (phones.data?.data ?? []).filter(
        (p) => !data.phoneNumberId || waba.id !== data.wabaId || p.id === data.phoneNumberId,
      );

      for (const phone of numbers) {
        // Tenant guard: a phone number can belong to exactly one company.
        const { data: clash } = await supabaseAdmin
          .from("whatsapp_accounts")
          .select("id, company_id")
          .eq("phone_number_id", phone.id)
          .neq("company_id", data.companyId)
          .maybeSingle();
        if (clash) throw new Error("meta_number_in_use");

        const { data: existing } = await supabaseAdmin
          .from("whatsapp_accounts")
          .select("id")
          .eq("phone_number_id", phone.id)
          .eq("company_id", data.companyId)
          .maybeSingle();

        const payload = {
          provider: "meta_cloud",
          phone_number: phone.display_phone_number ?? null,
          phone_number_id: phone.id,
          verified_name: phone.verified_name ?? null,
          business_account_id: waba.id,
          status: "connected" as const,
          is_active: true,
          updated_at: new Date().toISOString(),
        };
        if (existing) {
          await supabaseAdmin.from("whatsapp_accounts").update(payload).eq("id", existing.id);
        } else {
          await supabaseAdmin
            .from("whatsapp_accounts")
            .insert({ company_id: data.companyId, agent_id: null, ...payload });
        }
        connected.push({
          wabaId: waba.id,
          wabaName: waba.name ?? "",
          phoneNumber: phone.display_phone_number ?? phone.id,
          phoneNumberId: phone.id,
          verifiedName: phone.verified_name ?? null,
        });
      }

      // per-WABA message subscription (best effort)
      await meta.subscribeWaba(token, waba.id);
    }

    if (connected.length === 0) {
      if (lastPhoneError) fail(lastPhoneError.kind, lastPhoneError.detail);
      fail("meta_no_phone_numbers");
    }

    // 4) store the encrypted token for the company
    await meta.saveCompanyWhatsappToken(data.companyId, {
      access_token: token,
      token_type: "bearer",
      expires_in: expiresIn,
    });

    // 5) flag the company + document the connection
    await supabaseAdmin
      .from("companies")
      .update({ whatsapp_enabled: true, updated_at: new Date().toISOString() })
      .eq("id", data.companyId);
    await supabaseAdmin.from("connection_requests").insert({
      company_id: data.companyId,
      channel: "whatsapp",
      status: "approved",
      payload: {
        source: "embedded_signup",
        numbers: connected.map((c) => c.phoneNumber),
        waba: connected[0]?.wabaName ?? "",
      },
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    });
    // 6) register each number as a unified inbox with the voice/chat provider (best effort)
    const inboxes: { phoneNumberId: string; inboxId: string | null; error?: string }[] = [];
    try {
      const nabrah = await import("@/lib/nabrah.server");
      if (nabrah.nabrahConfigured()) {
        for (const c of connected) {
          try {
            const res = await nabrah.createWhatsappInbox({
              name: `${company.name} WhatsApp`.slice(0, 80),
              phone_number: c.phoneNumber.startsWith("+") ? c.phoneNumber : `+${c.phoneNumber.replace(/\D/g, "")}`,
              phone_number_id: c.phoneNumberId,
              business_account_id: c.wabaId,
              api_key: token,
              enable_auto_assignment: true,
            });
            const id = res?.inbox_id ?? res?.id;
            inboxes.push({ phoneNumberId: c.phoneNumberId, inboxId: id != null ? String(id) : null });
          } catch (e) {
            console.error("[omni inbox]", (e as Error).message);
            inboxes.push({ phoneNumberId: c.phoneNumberId, inboxId: null, error: (e as Error).message.slice(0, 200) });
          }
        }
      }
    } catch (e) {
      console.error("[omni inbox] load", (e as Error).message);
    }

    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "whatsapp.connected",
      entity: "whatsapp_accounts",
      metadata: { numbers: connected.map((c) => c.phoneNumber), webhook_ok: webhook.ok, inboxes },
    });

    return { ok: true, connected, webhookOk: webhook.ok };
  });

/** Connection test: token + WABA + phone number via Graph, plus agent assignment. */
export const testWhatsappConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = await import("@/lib/meta.server");

    const { data: accounts } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("id, phone_number, phone_number_id, business_account_id, agent_id, status, is_active")
      .eq("company_id", data.companyId)
      .limit(1);
    const account = accounts?.[0];
    if (!account || account.status !== "connected") throw new Error("whatsapp_not_connected");

    const token = await meta.loadCompanyWhatsappToken(data.companyId);
    if (!token) throw new Error("token_missing");

    const read = await meta.readPhoneNumber(token, account.phone_number_id ?? "");
    if (!read.ok) throw new Error(read.error.kind);

    const agentOk = account.agent_id
      ? !!(await supabaseAdmin.from("ai_agents").select("id").eq("id", account.agent_id).eq("is_active", true).maybeSingle()).data
      : false;

    return {
      ok: true,
      phone: read.data?.display_phone_number ?? account.phone_number,
      verifiedName: read.data?.verified_name ?? null,
      quality: read.data?.quality_rating ?? null,
      agentAssigned: agentOk,
    };
  });

/** Disconnect: disable accounts, remove the token, keep all history. */
export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = await import("@/lib/meta.server");

    const { data: accounts } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("id, business_account_id")
      .eq("company_id", data.companyId)
      .limit(1);
    const account = accounts?.[0];
    if (!account) throw new Error("whatsapp_not_connected");

    // best-effort unsubscribe with the still-stored token
    const token = await meta.loadCompanyWhatsappToken(data.companyId);
    if (token && account.business_account_id) {
      await meta.unsubscribeWaba(token, account.business_account_id);
    }

    await supabaseAdmin
      .from("whatsapp_accounts")
      .update({ status: "not_connected", is_active: false, agent_id: null, updated_at: new Date().toISOString() })
      .eq("company_id", data.companyId);
    await meta.deleteCompanyWhatsappToken(data.companyId);
    await supabaseAdmin
      .from("companies")
      .update({ whatsapp_enabled: false, updated_at: new Date().toISOString() })
      .eq("id", data.companyId);
    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "whatsapp.disconnected",
      entity: "whatsapp_accounts",
      metadata: {},
    });
    return { ok: true };
  });

/** Assign (or clear) the AI agent for a company's WhatsApp number. */
export const assignWhatsappAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        agentId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.agentId) {
      // the agent must belong to the same company (tenant isolation)
      const { data: agent } = await supabaseAdmin
        .from("ai_agents")
        .select("id")
        .eq("id", data.agentId)
        .eq("company_id", data.companyId)
        .maybeSingle();
      if (!agent) throw new Error("agent_not_in_company");
    }
    const { error } = await supabaseAdmin
      .from("whatsapp_accounts")
      .update({ agent_id: data.agentId, updated_at: new Date().toISOString() })
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "whatsapp.agent_assigned",
      entity: "whatsapp_accounts",
      metadata: { agent_id: data.agentId },
    });
    return { ok: true };
  });

/**
 * Links WhatsApp numbers already connected on the voice/chat provider side
 * to this company (no Meta popup needed). Each number belongs to one company.
 */
export const syncProviderWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertCanConnect(context, data.companyId);
    const nabrah = await import("@/lib/nabrah.server");
    if (!nabrah.nabrahConfigured()) throw new Error("not_configured");
    const inboxes = await nabrah.listWhatsappInboxes();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const linked: string[] = [];
    let taken = 0;
    for (const ib of inboxes) {
      const inboxId = String(ib.inbox_id ?? ib.id ?? "");
      const pid = String(ib.phone_number_id ?? (inboxId ? `inbox:${inboxId}` : ""));
      if (!pid) continue;
      const { data: rows } = await supabaseAdmin
        .from("whatsapp_accounts").select("id, company_id").eq("phone_number_id", pid);
      const other = (rows ?? []).find((r) => r.company_id !== data.companyId);
      if (other) { taken++; continue; }
      const mine = (rows ?? []).find((r) => r.company_id === data.companyId);
      const payload = {
        provider: "nabrah_omni",
        phone_number: (ib.phone_number as string) ?? null,
        phone_number_id: pid,
        verified_name: (ib.name as string) ?? null,
        business_account_id: (ib.business_account_id as string) ?? null,
        webhook_verify_token: inboxId || null,
        status: "connected" as const,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      if (mine) await supabaseAdmin.from("whatsapp_accounts").update(payload).eq("id", mine.id);
      else await supabaseAdmin.from("whatsapp_accounts").insert({ company_id: data.companyId, agent_id: null, ...payload });
      linked.push(payload.phone_number ?? pid);
    }
    if (linked.length) {
      await supabaseAdmin.from("companies")
        .update({ whatsapp_enabled: true, updated_at: new Date().toISOString() }).eq("id", data.companyId);
      await supabaseAdmin.from("audit_logs").insert({
        company_id: data.companyId, user_id: context.userId, action: "whatsapp.synced",
        entity: "whatsapp_accounts", metadata: { numbers: linked },
      });
    }
    return { linked, taken, total: inboxes.length };
  });
