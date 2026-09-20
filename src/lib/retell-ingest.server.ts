import type { RetellCall } from "./retell.server";

/**
 * Converts a Retell call object into platform rows (customer + voice_call +
 * usage). Server-only: uses the service-role client, so every caller must be
 * verified first (webhook signature or authenticated owner/admin).
 */
export async function ingestRetellCall(
  c: RetellCall,
): Promise<{ ok: boolean; reason?: string; companyId?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (!c.call_id) return { ok: false, reason: "missing_call_id" };

  const { data: agent } = await supabaseAdmin
    .from("ai_agents")
    .select("id, company_id")
    .eq("provider_agent_id", c.agent_id ?? "")
    .maybeSingle();

  if (!agent) return { ok: false, reason: "unknown_agent" };

  const inbound = (c.direction ?? "inbound") === "inbound";
  const customerNumber = inbound ? c.from_number : c.to_number;

  let customerId: string | null = null;
  if (customerNumber) {
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("company_id", agent.company_id)
      .eq("phone", customerNumber)
      .maybeSingle();
    if (existing) customerId = existing.id;
    else {
      const { data: created } = await supabaseAdmin
        .from("customers")
        .insert({ company_id: agent.company_id, phone: customerNumber })
        .select("id")
        .single();
      customerId = created?.id ?? null;
    }
  }

  const { data: phoneRow } = await supabaseAdmin
    .from("phone_numbers")
    .select("id")
    .eq("company_id", agent.company_id)
    .eq("phone_number", (inbound ? c.to_number : c.from_number) ?? "")
    .maybeSingle();

  const durationSeconds = Math.max(
    0,
    Math.round(
      (c.duration_ms ??
        (c.end_timestamp && c.start_timestamp ? c.end_timestamp - c.start_timestamp : 0)) / 1000,
    ),
  );

  const status =
    c.call_status === "ended"
      ? "completed"
      : c.call_status === "ongoing"
        ? "in_progress"
        : c.call_status === "registered"
          ? "ringing"
          : c.call_status === "error"
            ? "failed"
            : "completed";

  const transferred = /transfer/i.test(c.disconnection_reason ?? "");

  const row = {
    company_id: agent.company_id,
    agent_id: agent.id,
    customer_id: customerId,
    phone_number_id: phoneRow?.id ?? null,
    direction: inbound ? "inbound" : "outbound",
    from_number: c.from_number ?? null,
    to_number: c.to_number ?? null,
    status: status as "completed" | "in_progress" | "ringing" | "failed" | "transferred",
    duration_seconds: durationSeconds,
    transferred,
    provider: "retell",
    provider_call_id: c.call_id,
    recording_url: c.recording_url ?? null,
    ended_reason: c.disconnection_reason ?? null,
    started_at: c.start_timestamp ? new Date(c.start_timestamp).toISOString() : null,
    ended_at: c.end_timestamp ? new Date(c.end_timestamp).toISOString() : null,
  };

  const { data: existingCall } = await supabaseAdmin
    .from("voice_calls")
    .select("id")
    .eq("provider", "retell")
    .eq("provider_call_id", c.call_id)
    .maybeSingle();

  let callId = existingCall?.id ?? null;
  if (callId) {
    const { error } = await supabaseAdmin.from("voice_calls").update(row).eq("id", callId);
    if (error) return { ok: false, reason: error.message };
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("voice_calls")
      .insert(row)
      .select("id")
      .single();
    if (error) return { ok: false, reason: error.message };
    callId = inserted.id;

    if (durationSeconds > 0) {
      await supabaseAdmin.from("usage_records").insert({
        company_id: agent.company_id,
        metric: "voice_minutes",
        quantity: Number((durationSeconds / 60).toFixed(2)),
        unit: "minute",
        reference_id: callId,
      });
    }
  }

  return { ok: true, companyId: agent.company_id };
}
