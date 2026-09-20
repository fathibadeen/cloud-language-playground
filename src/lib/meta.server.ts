/**
 * Meta WhatsApp Cloud API helpers — server-only.
 * Every secret (app secret, per-company access tokens) stays here; nothing
 * here is imported by client-reachable code.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const GRAPH_BASE = "https://graph.facebook.com";

export function getMetaEnv() {
  return {
    appId: process.env["META_APP_ID"] ?? "",
    appSecret: process.env["META_APP_SECRET"] ?? "",
    configId: process.env["META_CONFIG_ID"] ?? "",
    redirectUri: process.env["META_REDIRECT_URI"] ?? "",
    graphVersion: process.env["META_GRAPH_API_VERSION"] ?? "v21.0",
    verifyToken: process.env["WHATSAPP_VERIFY_TOKEN"] ?? "",
  };
}

export function metaConfigured(): boolean {
  const env = getMetaEnv();
  return !!(env.appId && env.appSecret && env.configId);
}

/** Stable webhook callback URL path served by this app. */
export const WHATSAPP_WEBHOOK_PATH = "/api/public/webhooks/whatsapp";

// ---------- credential encryption (AES-256-GCM) ----------

function encryptionKey(): Buffer {
  const key = process.env["ENCRYPTION_KEY"];
  if (!key) throw new Error("encryption_key_missing");
  return createHash("sha256").update(key).digest();
}

export function encryptJson(payload: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptJson<T>(blob: string): T {
  const [ivB64, tagB64, dataB64] = blob.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("encrypted_payload_invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}

// ---------- Graph API ----------

export type GraphResult<T> = { ok: true; data: T } | { ok: false; status: number; error: MetaError };

export type MetaError = {
  kind:
    | "meta_not_configured"
    | "meta_auth_failed"
    | "meta_business_verification"
    | "meta_no_waba"
    | "meta_no_phone_numbers"
    | "meta_number_in_use"
    | "meta_api_error"
    | "meta_webhook_error";
  detail?: string;
};

type GraphErrorBody = {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
};

export async function graphCall<T>(
  path: string,
  token: string,
  version: string,
  init?: { method?: string; params?: Record<string, string> },
): Promise<GraphResult<T>> {
  const method = init?.method ?? "GET";
  const url = new URL(`${GRAPH_BASE}/${version}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(init?.params ?? {})) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", token);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return { ok: false, status: 502, error: { kind: "meta_api_error", detail: String(err) } };
  }
  const body = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!res.ok) {
    const err = body?.error;
    const message = err?.message ?? `Meta API error ${res.status}`;
    const code = err?.code ?? 0;
    // Business verification / app-review related codes.
    if (code === 1383007 || code === 10 || /verif/i.test(message)) {
      return { ok: false, status: res.status, error: { kind: "meta_business_verification", detail: message } };
    }
    if (res.status === 401 || code === 190 || code === 102) {
      return { ok: false, status: res.status, error: { kind: "meta_auth_failed", detail: message } };
    }
    return { ok: false, status: res.status, error: { kind: "meta_api_error", detail: message } };
  }
  return { ok: true, data: body };
}

/** Exchanges the Embedded Signup code for a short-lived user token. */
export async function exchangeCodeForToken(code: string) {
  const env = getMetaEnv();
  if (!env.appId || !env.appSecret) {
    return { ok: false as const, error: { kind: "meta_not_configured" } as MetaError };
  }
  const url = new URL(`${GRAPH_BASE}/${env.graphVersion}/oauth/access_token`);
  url.searchParams.set("client_id", env.appId);
  url.searchParams.set("client_secret", env.appSecret);
  url.searchParams.set("code", code);
  const res = await fetch(url.toString());
  const body = (await res.json().catch(() => ({}))) as { access_token?: string } & GraphErrorBody;
  if (!res.ok || !body.access_token) {
    const message = body?.error?.message ?? "Meta authorization failed";
    return { ok: false as const, error: { kind: "meta_auth_failed", detail: message } as MetaError };
  }
  return { ok: true as const, token: body.access_token };
}

/** Exchanges a short-lived token for a long-lived one (~60 days). */
export async function exchangeLongLivedToken(shortToken: string) {
  const env = getMetaEnv();
  const url = new URL(`${GRAPH_BASE}/${env.graphVersion}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", env.appId);
  url.searchParams.set("client_secret", env.appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url.toString());
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  } & GraphErrorBody;
  if (!res.ok || !body.access_token) {
    const message = body?.error?.message ?? "Meta token exchange failed";
    return { ok: false as const, error: { kind: "meta_auth_failed", detail: message } as MetaError };
  }
  return { ok: true as const, token: body.access_token, expiresIn: body.expires_in ?? null };
}

export type OwnedWaba = {
  id: string;
  name?: string;
  account_review_status?: string;
  verification_status?: string;
};

export async function fetchOwnedWabas(token: string) {
  const env = getMetaEnv();
  return graphCall<{ data?: OwnedWaba[] }>(
    "me/owned_whatsapp_business_accounts",
    token,
    env.graphVersion,
    { params: { fields: "id,name,account_review_status,verification_status", limit: "50" } },
  );
}

export type WabaPhoneNumber = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
};

export async function fetchWabaPhoneNumbers(token: string, wabaId: string) {
  const env = getMetaEnv();
  return graphCall<{ data?: WabaPhoneNumber[] }>(`${wabaId}/phone_numbers`, token, env.graphVersion, {
    params: { fields: "id,display_phone_number,verified_name,quality_rating", limit: "50" },
  });
}

/** Subscribes the Meta app-level webhook (callback URL + verify token). */
export async function configureAppWebhook(callbackUrl: string) {
  const env = getMetaEnv();
  if (!env.appId || !env.appSecret || !env.verifyToken) {
    return { ok: false as const, error: { kind: "meta_webhook_error" } as MetaError };
  }
  const url = new URL(`${GRAPH_BASE}/${env.graphVersion}/${env.appId}/subscriptions`);
  url.searchParams.set("access_token", `${env.appId}|${env.appSecret}`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      object: "whatsapp_business_account",
      callback_url: callbackUrl,
      verify_token: env.verifyToken,
      fields: ["messages", "message_template_status_update"],
      include_values: true,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean } & GraphErrorBody;
  if (!res.ok || body.success !== true) {
    return {
      ok: false as const,
      error: { kind: "meta_webhook_error", detail: body?.error?.message ?? `HTTP ${res.status}` } as MetaError,
    };
  }
  return { ok: true as const };
}

/** Subscribes the app to a specific WhatsApp Business Account. */
export async function subscribeWaba(token: string, wabaId: string) {
  const env = getMetaEnv();
  return graphCall<{ success?: boolean }>(`${wabaId}/subscribed_apps`, token, env.graphVersion, {
    method: "POST",
  });
}

export async function unsubscribeWaba(token: string, wabaId: string) {
  const env = getMetaEnv();
  return graphCall<{ success?: boolean }>(`${wabaId}/subscribed_apps`, token, env.graphVersion, {
    method: "DELETE",
  });
}

export async function readPhoneNumber(token: string, phoneNumberId: string) {
  const env = getMetaEnv();
  return graphCall<WabaPhoneNumber>(phoneNumberId, token, env.graphVersion, {
    params: { fields: "id,display_phone_number,verified_name,quality_rating" },
  });
}

// ---------- per-company credential storage ----------

type WhatsappTokenPayload = {
  access_token: string;
  token_type?: string;
  expires_in?: number | null;
  obtained_at: string;
};

export async function saveCompanyWhatsappToken(
  companyId: string,
  payload: Omit<WhatsappTokenPayload, "obtained_at">,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const stored: WhatsappTokenPayload = { ...payload, obtained_at: new Date().toISOString() };
  const { data: existing } = await supabaseAdmin
    .from("provider_credentials")
    .select("id")
    .eq("company_id", companyId)
    .eq("scope", "whatsapp")
    .maybeSingle();
  const encrypted = encryptJson(stored);
  if (existing) {
    await supabaseAdmin
      .from("provider_credentials")
      .update({ secret_payload: { encrypted }, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("provider_credentials").insert({
      company_id: companyId,
      scope: "whatsapp",
      provider: "meta_cloud",
      secret_payload: { encrypted },
    });
  }
}

export async function deleteCompanyWhatsappToken(companyId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("provider_credentials")
    .delete()
    .eq("company_id", companyId)
    .eq("scope", "whatsapp");
}

/** Loads + decrypts the company's WhatsApp token (null when absent). */
export async function loadCompanyWhatsappToken(companyId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("provider_credentials")
    .select("secret_payload")
    .eq("company_id", companyId)
    .eq("scope", "whatsapp")
    .maybeSingle();
  if (!data) return null;
  try {
    const encrypted = (data.secret_payload as { encrypted?: string })?.encrypted;
    if (!encrypted) return null;
    const payload = decryptJson<WhatsappTokenPayload>(encrypted);
    return payload.access_token ?? null;
  } catch {
    return null;
  }
}

// ---------- outbound messaging ----------

export type SendResult = { ok: boolean; status?: number; error?: string; providerId?: string };

export async function sendMetaText(
  phoneNumberId: string,
  token: string,
  to: string,
  body: string,
): Promise<SendResult> {
  const env = getMetaEnv();
  const url = `${GRAPH_BASE}/${env.graphVersion}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  const providerId = payload?.messages?.[0]?.id;
  if (!res.ok) {
    return { ok: false, status: res.status, error: payload?.error?.message ?? `HTTP ${res.status}` };
  }
  return providerId ? { ok: true, providerId } : { ok: true };
}
