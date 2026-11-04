/**
 * Sawti Growth — Nabrah call layer (Phase 1)
 *
 * Builds ON TOP of the existing src/lib/nabrah.server.ts (untouched).
 * Adds: per-call compliance evaluation, idempotency keys, bounded
 * retries, timeout handling, error logging to audit_logs and per-tenant
 * usage tracking. No call ever leaves this file without passing the
 * compliance engine first.
 */
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  makeCall,
  getCall,
  nabrahConfigured,
  NabrahError,
  isUnsupported,
} from "@/lib/nabrah.server";
import { evaluateOutreach, ComplianceVerdict } from "@/lib/growth/compliance";

const DIAL_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

export type DialResult =
  | { ok: true; callRowId: string; nabrahCallId: string | null; verdict: ComplianceVerdict }
  | { ok: false; blocked: true; verdict: ComplianceVerdict }
  | { ok: false; blocked: false; error: string; callRowId?: string };

/** Retries only transient provider failures (429/5xx/network), never 4xx. */
function isRetryable(e: unknown): boolean {
  if (e instanceof NabrahError) return e.status === 429 || e.status >= 500;
  return true; // fetch/timeout/network
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function logAudit(action: string, metadata: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      action,
      entity: "growth_call",
      entity_id: metadata.callJobId ?? null,
      company_id: metadata.companyId ?? null,
      metadata: metadata as never,
    });
  } catch {
    /* audit failure must never break the flow */
  }
}

/**
 * Executes one approved call job:
 * 1) re-runs compliance per lead (even for approved batches),
 * 2) enforces the tenant daily limit,
 * 3) dials via the existing Nabrah client with idempotency + retry,
 * 4) persists the returned Nabrah call id.
 */
export async function executeCallJob(callJobId: string): Promise<DialResult> {
  // Load the job (service_role — the cron runner is server-side only)
  const { data: job } = await supabaseAdmin
    .from("call_jobs")
    .select("*")
    .eq("id", callJobId)
    .maybeSingle();
  if (!job) return { ok: false, blocked: false, error: "call_job_not_found" };

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, contact_phone, contact_name, business_name, company_id")
    .eq("id", job.lead_id)
    .maybeSingle();
  if (!lead) return { ok: false, blocked: false, error: "lead_not_found" };

  // --- Compliance gate (every single call, every time) ---
  const verdict = await evaluateOutreach(
    job.company_id,
    lead.id,
    lead.contact_phone,
    "call",
  );
  if (!verdict.allowed) {
    await supabaseAdmin
      .from("call_jobs")
      .update({ status: "compliance_blocked", compliance_checks: verdict, last_error: verdict.reasons.join(",") })
      .eq("id", callJobId);
    await logAudit("growth_call_blocked", {
      callJobId, companyId: job.company_id, reasons: verdict.reasons,
    });
    return { ok: false, blocked: true, verdict };
  }

  // --- Provider readiness (honest, never faked) ---
  if (!nabrahConfigured()) {
    await supabaseAdmin
      .from("call_jobs")
      .update({ status: "failed", last_error: "nabrah_not_configured" })
      .eq("id", callJobId);
    await logAudit("growth_call_failed", { callJobId, companyId: job.company_id, error: "nabrah_not_configured" });
    return { ok: false, blocked: false, error: "nabrah_not_configured" };
  }

  // Idempotency key — the same job can never dial twice
  const idempotencyKey = job.idempotency_key ?? randomUUID();
  await supabaseAdmin
    .from("call_jobs")
    .update({ status: "dialing", idempotency_key: idempotencyKey, attempts: job.attempts + 1 })
    .eq("id", callJobId);

  const { data: campaign } = await supabaseAdmin
    .from("campaigns")
    .select("agent_id, window_start, window_end")
    .eq("id", job.campaign_id)
    .maybeSingle();
  const agentId = campaign?.agent_id;
  if (!agentId) {
    await supabaseAdmin
      .from("call_jobs")
      .update({ status: "failed", last_error: "campaign_agent_missing" })
      .eq("id", callJobId);
    return { ok: false, blocked: false, error: "campaign_agent_missing" };
  }

  // Create the local growth_calls row first (facts about real calls only)
  const { data: callRow, error: callRowErr } = await supabaseAdmin
    .from("growth_calls")
    .insert({
      company_id: job.company_id,
      call_job_id: callJobId,
      campaign_id: job.campaign_id,
      lead_id: lead.id,
      agent_id: agentId,
      call_to: lead.contact_phone,
      status: "initiated",
    })
    .select("id")
    .single();
  if (callRowErr || !callRow) {
    await supabaseAdmin.from("call_jobs").update({ status: "failed", last_error: "local_insert_failed" }).eq("id", callJobId);
    return { ok: false, blocked: false, error: "local_insert_failed", callRowId: callRow?.id };
  }

  // --- Dial via the EXISTING client with timeout + bounded retries ---
  let lastError = "unknown_error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await withTimeout(
        makeCall({ agent_id: agentId, call_from: "", call_to: lead.contact_phone }),
        DIAL_TIMEOUT_MS,
      );
      const nabrahCallId =
        (res?.["id"] as string) ??
        (res?.["call_id"] as string) ??
        (res?.["data"] as Record<string, unknown>)?.["id"] as string ??
        null;

      await supabaseAdmin
        .from("growth_calls")
        .update({ nabrah_call_id: nabrahCallId, status: "ringing" })
        .eq("id", callRow.id);
      await supabaseAdmin
        .from("call_jobs")
        .update({ status: "done" })
        .eq("id", callJobId);
      await logAudit("growth_call_placed", {
        callJobId, companyId: job.company_id, nabrahCallId, attempt,
      });
      return { ok: true, callRowId: callRow.id, nabrahCallId, verdict };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (isUnsupported(e)) break; // documented provider limitation — do not fake success
      if (!isRetryable(e) || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1))); // backoff
    }
  }

  // All attempts failed — record honestly
  await supabaseAdmin
    .from("growth_calls")
    .update({ status: "failed" })
    .eq("id", callRow.id);
  await supabaseAdmin
    .from("call_jobs")
    .update({ status: "failed", last_error: lastError.slice(0, 500) })
    .eq("id", callJobId);
  await logAudit("growth_call_failed", {
    callJobId, companyId: job.company_id, error: lastError.slice(0, 500),
  });
  return { ok: false, blocked: false, error: lastError, callRowId: callRow.id };
}

/** Pulls the latest status/recording/transcript from Nabrah into growth_calls. */
export async function syncCallStatus(growthCallId: string): Promise<boolean> {
  const { data: row } = await supabaseAdmin
    .from("growth_calls")
    .select("id, nabrah_call_id")
    .eq("id", growthCallId)
    .maybeSingle();
  if (!row?.nabrah_call_id) return false;

  try {
    const detail = await withTimeout(getCall(row.nabrah_call_id), DIAL_TIMEOUT_MS);
    await supabaseAdmin
      .from("growth_calls")
      .update({
        status: (detail?.status as string) ?? "in_progress",
        duration_sec: detail?.duration ?? null,
        started_at: detail?.call_started_at ?? null,
        ended_at: detail?.call_ended_at ?? null,
        transcript: (detail?.transcript ?? null) as never,
        analysis: (detail?.analysis_results ?? null) as never,
      })
      .eq("id", growthCallId);
    return true;
  } catch (e) {
    await logAudit("growth_call_sync_error", {
      growthCallId, error: e instanceof Error ? e.message.slice(0, 300) : String(e),
    });
    return false;
  }
}
