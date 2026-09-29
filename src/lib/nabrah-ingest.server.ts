/**
 * Converts a Nabrah webhook payload into platform rows (customer + voice_call
 * + usage). The platform agent is already identified by the verified webhook
 * URL token, so the company can never come from the payload itself.
 * Nabrah's payload shape is not formally documented; fields are read
 * defensively from common names.
 */
type Json = Record<string, unknown>;

function pick(o: Json, keys: string[]): unknown {
  for (const k of keys) {
    const parts = k.split(".");
    let cur: unknown = o;
    for (const p of parts) cur = cur && typeof cur === "object" ? (cur as Json)[p] : undefined;
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}
const str = (v: unknown) => (v === undefined ? null : String(v));

export async function ingestNabrahCall(
  agentRowId: string,
  payload: Json,
): Promise<{ ok: boolean; reason?: string; companyId?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: agent } = await supabaseAdmin
    .from("ai_agents")
    .select("id, company_id")
    .eq("id", agentRowId)
    .maybeSingle();
  if (!agent) return { ok: false, reason: "unknown_agent" };

  const call = (pick(payload, ["call", "data.call", "data"]) as Json | undefined) ?? payload;
  const callId = str(pick(call, ["call_id", "callId", "id", "session_id", "sessionId"]));
  if (!callId) return { ok: false, reason: "missing_call_id", companyId: agent.company_id };

  const direction = String(pick(call, ["direction"]) ?? "inbound").toLowerCase();
  const inbound = !direction.startsWith("out");
  const from = str(pick(call, ["from_number", "from", "caller", "caller_number", "contact.phone"]));
  const to = str(pick(call, ["to_number", "to", "callee", "did"]));
  const customerNumber = inbound ? from : to;

  let customerId: string | null = null;
  if (customerNumber) {
    const { data: existing } = await supabaseAdmin
      .from("customers").select("id")
      .eq("company_id", agent.company_id).eq("phone", customerNumber).maybeSingle();
    if (existing) customerId = existing.id;
    else {
      const { data: created } = await supabaseAdmin
        .from("customers").insert({ company_id: agent.company_id, phone: customerNumber })
        .select("id").single();
      customerId = created?.id ?? null;
    }
  }

  const rawDur = Number(pick(call, ["duration_seconds", "duration", "call_duration"]) ?? 0);
  const durMs = Number(pick(call, ["duration_ms"]) ?? 0);
  const durationSeconds = Math.max(0, Math.round(durMs ? durMs / 1000 : rawDur || 0));
  const rawStatus = String(pick(call, ["status", "call_status", "event"]) ?? "").toLowerCase();
  const status = /fail|error/.test(rawStatus)
    ? "failed"
    : /transfer/.test(rawStatus)
      ? "transferred"
      : /progress|ongoing|started/.test(rawStatus)
        ? "in_progress"
        : /ring/.test(rawStatus)
          ? "ringing"
          : "completed";
  const endedReason = str(pick(call, ["ended_reason", "end_reason", "disconnection_reason"]));
  const started = pick(call, ["started_at", "start_time", "start_timestamp"]);
  const ended = pick(call, ["ended_at", "end_time", "end_timestamp"]);
  const toIso = (v: unknown) => {
    if (v === undefined) return null;
    const d = new Date(typeof v === "number" ? v : String(v));
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const row = {
    company_id: agent.company_id,
    agent_id: agent.id,
    customer_id: customerId,
    direction: inbound ? "inbound" : "outbound",
    from_number: from,
    to_number: to,
    status: status as "completed" | "in_progress" | "ringing" | "failed" | "transferred",
    duration_seconds: durationSeconds,
    transferred: status === "transferred" || /transfer/i.test(endedReason ?? ""),
    provider: "nabrah",
    provider_call_id: callId,
    recording_url: str(pick(call, ["recording_url", "recording", "recordingUrl"])),
    ended_reason: endedReason,
    started_at: toIso(started),
    ended_at: toIso(ended),
  };

  const { data: existingCall } = await supabaseAdmin
    .from("voice_calls").select("id")
    .eq("provider", "nabrah").eq("provider_call_id", callId).maybeSingle();

  if (existingCall) {
    const { error } = await supabaseAdmin.from("voice_calls").update(row).eq("id", existingCall.id);
    if (error) return { ok: false, reason: error.message, companyId: agent.company_id };
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("voice_calls").insert(row).select("id").single();
    if (error) return { ok: false, reason: error.message, companyId: agent.company_id };
    if (durationSeconds > 0) {
      await supabaseAdmin.from("usage_records").insert({
        company_id: agent.company_id,
        metric: "voice_minutes",
        quantity: Number((durationSeconds / 60).toFixed(2)),
        unit: "minute",
        reference_id: inserted.id,
      });
    }
  }
  return { ok: true, companyId: agent.company_id };
}
