import { createHmac, timingSafeEqual } from "crypto";

/**
 * Nabrah (nabrah.ai) helpers. Nabrah does not publish a programmable REST
 * reference for agents/calls, so agents are created in the Nabrah dashboard
 * and linked here (direct link + agent id). Calls arrive via the agent's
 * webhook, authenticated with a per-agent token derived from
 * NABRAH_WEBHOOK_SECRET.
 */
export function agentWebhookToken(agentId: string): string {
  const secret = process.env["NABRAH_WEBHOOK_SECRET"];
  if (!secret) throw new Error("nabrah_webhook_secret_missing");
  return createHmac("sha256", secret).update(`nabrah:${agentId}`).digest("hex").slice(0, 40);
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
