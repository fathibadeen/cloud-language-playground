import { createHmac, timingSafeEqual } from "crypto";

/**
 * Nabrah (nabrah.ai) External API client — https://api.nabrah.ai/api/ext
 * One project-level API key (NABRAH_API_KEY) authenticates every call;
 * per-company isolation comes from the agent ids stored on ai_agents.
 * Inbound calls also reach us through the agent webhook, authenticated with a
 * per-agent token derived from NABRAH_WEBHOOK_SECRET.
 */
const BASE = "https://api.nabrah.ai/api/ext";

export const SITE = "https://www.sawti-ai.com";

export function nabrahConfigured(): boolean {
  return !!process.env["NABRAH_API_KEY"];
}

export function agentWebhookToken(agentId: string): string {
  const secret = process.env["NABRAH_WEBHOOK_SECRET"];
  if (!secret) throw new Error("nabrah_webhook_secret_missing");
  return createHmac("sha256", secret).update(`nabrah:${agentId}`).digest("hex").slice(0, 40);
}

export function agentWebhookUrl(agentId: string): string {
  return `${SITE}/api/public/webhooks/nabrah?agent=${agentId}&token=${agentWebhookToken(agentId)}`;
}

export function verifyAgentWebhookToken(agentId: string, token: string): boolean {
  try {
    const a = Buffer.from(agentWebhookToken(agentId));
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export class NabrahError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const key = process.env["NABRAH_API_KEY"];
  if (!key) throw new NabrahError("nabrah_not_configured", 503);
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "X-API-Key": key,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { detail?: unknown; message?: unknown };
      detail = String(j.detail ?? j.message ?? detail);
    } catch {
      /* raw text */
    }
    throw new NabrahError(detail || `nabrah_error_${res.status}`, res.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/* ---------------- Agents ---------------- */

export type NabrahAgentSummary = {
  agent_id: string;
  name: string;
  created_at?: string;
  last_update?: string;
};

export type NabrahAgentDetail = NabrahAgentSummary & {
  first_sentence?: string | null;
  who_are_you?: string | null;
  goal?: string | null;
  steps?: string | null;
  voice?: string | null;
  languages?: string[];
  language_mode?: string;
  speech_speed?: number;
  start_first?: boolean;
  allow_interruptions?: boolean;
  post_call_callback?: { url?: string } | null;
  post_analysis_callback?: { url?: string } | null;
};

export function listAgents() {
  return call<NabrahAgentSummary[]>("/agent");
}

export function getAgent(agentId: string) {
  return call<NabrahAgentDetail>(`/agent/${agentId}`);
}

export type AgentPayload = {
  name: string;
  start_first?: boolean;
  first_sentence?: string;
  agent_type?: string;
  who_are_you?: string;
  goal?: string;
  steps?: string;
  allow_interruptions?: boolean;
  voice?: string;
  languages?: string[];
  language_mode?: string;
  speech_speed?: number;
  stack?: string;
  support_data?: string;
  post_call_callback?: { url: string; parameters?: unknown[] } | undefined;
  post_analysis_callback?: { url: string; parameters?: unknown[] } | undefined;
};

export function createAgent(payload: AgentPayload) {
  return call<NabrahAgentDetail>("/agent", { method: "POST", body: payload });
}

export function updateAgent(agentId: string, payload: Partial<AgentPayload>) {
  return call<NabrahAgentDetail>(`/agent/${agentId}`, { method: "PUT", body: payload });
}

/* ---------------- Calls ---------------- */

export type NabrahCallSummary = {
  id: string;
  created_at: string;
  call_from: string | null;
  call_to: string | null;
  call_type: string | null;
  status: string;
  duration: number | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  agent_id: string;
  agent_name?: string | null;
  tags?: string[];
};

export type NabrahCallDetail = NabrahCallSummary & {
  recording_file?: string | null;
  transcript?: unknown[];
  analysis_results?: unknown[];
  variables?: Record<string, unknown>;
};

export function searchCalls(body: {
  limit?: number;
  offset?: number;
  created_at_start?: string;
  created_at_end?: string;
}) {
  return call<{ calls: NabrahCallSummary[]; total_count: number }>("/call/search", {
    method: "POST",
    body: { limit: 50, offset: 0, ...body },
  });
}

export function getCall(callId: string) {
  return call<NabrahCallDetail>(`/call/${callId}`);
}

export async function getRecordingLink(callId: string): Promise<string | null> {
  try {
    const res = await call<unknown>(`/call/get-download-link/${callId}`);
    if (typeof res === "string") return res;
    const o = res as Record<string, unknown> | null;
    const v = o?.["url"] ?? o?.["download_link"] ?? o?.["link"] ?? o?.["download_url"];
    return v ? String(v) : null;
  } catch {
    return null;
  }
}

export function makeCall(body: { agent_id: string; call_from: string; call_to: string }) {
  return call<Record<string, unknown>>("/call/make-call", { method: "POST", body });
}

/* ---------------- Knowledge base ---------------- */

export type NabrahKb = { id: string; name: string; key: string; desc?: string | null; document_count?: number };

export function listKnowledgeBases() {
  return call<NabrahKb[]>("/kb");
}

export function createKnowledgeBase(body: { name: string; key: string; desc: string }) {
  return call<NabrahKb>("/kb", { method: "POST", body });
}

export function addTextDocument(knowledgeBaseId: string, text: string) {
  return call<Record<string, unknown>>("/document/text", {
    method: "POST",
    body: { knowledge_base_id: knowledgeBaseId, text },
  });
}

/* ---------------- SIP inbound numbers ---------------- */

export type NabrahSip = {
  id: string;
  name: string;
  numbers: string;
  allowed_addresses?: string[];
  auth_username?: string;
};

export function listSipInbound() {
  return call<{ items: NabrahSip[] }>("/sip-inbound");
}

export function linkAgentToInbound(agentId: string, inboundId: string) {
  return call<Record<string, unknown>>("/agent-inbound-link", {
    method: "POST",
    body: { agent_id: agentId, inbound_id: inboundId },
  });
}
