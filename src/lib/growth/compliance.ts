/**
 * Sawti Growth — Compliance Engine (Phase 1)
 *
 * The single authority that decides whether an outreach attempt is allowed.
 * Every call/message must pass ALL checks individually — campaign approval
 * NEVER substitutes for missing consent and NEVER bypasses suppression.
 *
 * Fail-closed: any missing configuration blocks the outreach.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Channel = "call" | "whatsapp";

export type ComplianceVerdict = {
  allowed: boolean;
  checks: {
    killSwitch: boolean; // global + tenant pause both OFF
    notSuppressed: boolean; // phone not on global/tenant suppression lists
    hasConsent: boolean; // documented lawful basis for this channel
    withinTimeWindow: boolean; // inside configured calling hours & work days
    withinDailyLimit: boolean; // tenant daily cap not exceeded
    legalReviewConfirmed: boolean; // tenant confirmed PDPL legal review
    callerIdVerified: boolean; // Saudi caller ID verified for calls
    aiIdentificationPresent: boolean; // honest AI/business identification set
  };
  reasons: string[];
};

const DEFAULTS = {
  timezone: "Asia/Riyadh",
  workDays: [0, 1, 2, 3, 4], // Sunday..Thursday (Saudi business week)
  callWindow: { start: "09:00", end: "18:00" },
  whatsappWindow: { start: "09:00", end: "20:00" },
  dailyCallLimit: 20,
  dailyMessageLimit: 100,
};

/** Normalizes a Saudi/international number to E.164-ish (+9665XXXXXXXX). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+966${digits.slice(1)}`;
  if (digits.startsWith("966")) return `+${digits}`;
  if (digits.startsWith("5") && digits.length === 9) return `+966${digits}`;
  return `+${digits}`;
}

type GrowthSettingsRow = {
  timezone: string;
  work_days: number[];
  call_window_start: string;
  call_window_end: string;
  whatsapp_window_start: string;
  whatsapp_window_end: string;
  daily_call_limit: number;
  daily_message_limit: number;
  campaigns_paused: boolean;
  legal_review_confirmed: boolean;
  caller_id_verified: boolean;
  ai_identification_text: string;
};

export async function getGrowthSettings(companyId: string): Promise<GrowthSettingsRow> {
  const { data } = await supabaseAdmin
    .from("growth_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (data) return data as GrowthSettingsRow;
  // Defaults (fail-closed values apply: paused, unverified, unreviewed)
  return {
    timezone: DEFAULTS.timezone,
    work_days: DEFAULTS.workDays,
    call_window_start: DEFAULTS.callWindow.start,
    call_window_end: DEFAULTS.callWindow.end,
    whatsapp_window_start: DEFAULTS.whatsappWindow.start,
    whatsapp_window_end: DEFAULTS.whatsappWindow.end,
    daily_call_limit: DEFAULTS.dailyCallLimit,
    daily_message_limit: DEFAULTS.dailyMessageLimit,
    campaigns_paused: true,
    legal_review_confirmed: false,
    caller_id_verified: false,
    ai_identification_text: "",
  };
}

/** Is "now" (Riyadh by default) inside the allowed window for the channel? */
export function isWithinTimeWindow(
  settings: Pick<GrowthSettingsRow, "timezone" | "work_days">,
  channel: Channel,
  now = new Date(),
): boolean {
  const riyadhNow = new Date(now.toLocaleString("en-US", { timeZone: settings.timezone }));
  const day = riyadhNow.getDay();
  if (!settings.work_days.includes(day)) return false;

  const minutes = riyadhNow.getHours() * 60 + riyadhNow.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const win =
    channel === "call"
      ? { start: toMin(DEFAULTS.callWindow.start), end: toMin(DEFAULTS.callWindow.end) }
      : { start: toMin(DEFAULTS.whatsappWindow.start), end: toMin(DEFAULTS.whatsappWindow.end) };
  return minutes >= win.start && minutes < win.end;
}

/** Counts today's (Riyadh) completed outreach attempts for the tenant. */
export async function countTodayOutreach(companyId: string, channel: Channel): Promise<number> {
  const startOfDay = new Date(
    new Date().toLocaleString("en-US", { timeZone: DEFAULTS.timezone }).split(",")[0] + "T00:00:00",
  );
  const table = channel === "call" ? "growth_calls" : "growth_messages";
  const { count } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", startOfDay.toISOString());
  return count ?? 0;
}

/**
 * THE gate. Runs per lead, per channel, before any single outreach.
 * Approval of a campaign/batch does not appear here on purpose — it is a
 * separate prerequisite checked by the scheduler, and even an approved
 * batch is re-verified here for every individual lead at dial time.
 */
export async function evaluateOutreach(
  companyId: string,
  leadId: string,
  phone: string,
  channel: Channel,
  now = new Date(),
): Promise<ComplianceVerdict> {
  const reasons: string[] = [];

  // 1) Global kill switch (service-managed) + tenant pause
  const { data: flags } = await supabaseAdmin
    .from("growth_global_flags")
    .select("all_outreach_disabled")
    .eq("id", 1)
    .maybeSingle();
  const globalDisabled = flags?.all_outreach_disabled ?? true; // fail-closed
  const settings = await getGrowthSettings(companyId);
  const killSwitch = !globalDisabled && !settings.campaigns_paused;
  if (!killSwitch) {
    reasons.push(
      globalDisabled ? "global_kill_switch_active" : "tenant_campaigns_paused",
    );
  }

  // 2) Suppression — global + tenant, checked per number
  const normalized = normalizePhone(phone);
  const { data: suppressed } = await supabaseAdmin
    .from("suppression_list")
    .select("id")
    .eq("phone", normalized)
    .or(`company_id.is.null,company_id.eq.${companyId}`);
  const notSuppressed = (suppressed ?? []).length === 0;
  if (!notSuppressed) reasons.push("phone_suppressed");

  // 3) Consent — documented lawful basis for THIS channel, not withdrawn
  const { data: consent } = await supabaseAdmin
    .from("consent_records")
    .select("id")
    .eq("company_id", companyId)
    .eq("lead_id", leadId)
    .eq("channel", channel)
    .not("granted_at", "is", null)
    .is("withdrawn_at", null)
    .limit(1);
  const hasConsent = (consent ?? []).length > 0;
  if (!hasConsent) reasons.push("no_valid_consent_for_channel");

  // 4) Time window (Saudi calling restrictions — configurable)
  const withinTimeWindow = isWithinTimeWindow(settings, channel, now);
  if (!withinTimeWindow) reasons.push("outside_permitted_time_window");

  // 5) Daily limit (ceiling, not permission)
  const limit = channel === "call" ? settings.daily_call_limit : settings.daily_message_limit;
  const used = await countTodayOutreach(companyId, channel);
  const withinDailyLimit = used < limit;
  if (!withinDailyLimit) reasons.push("daily_limit_reached");

  // 6) Legal review + caller ID (calls only) + AI identification
  const legalReviewConfirmed = settings.legal_review_confirmed;
  if (!legalReviewConfirmed) reasons.push("legal_review_not_confirmed");
  const callerIdVerified = channel === "call" ? settings.caller_id_verified : true;
  if (!callerIdVerified) reasons.push("caller_id_not_verified");
  const aiIdentificationPresent =
    channel === "call" ? settings.ai_identification_text.trim().length > 0 : true;
  if (!aiIdentificationPresent) reasons.push("ai_identification_missing");

  return {
    allowed:
      killSwitch &&
      notSuppressed &&
      hasConsent &&
      withinTimeWindow &&
      withinDailyLimit &&
      legalReviewConfirmed &&
      callerIdVerified &&
      aiIdentificationPresent,
    checks: {
      killSwitch,
      notSuppressed,
      hasConsent,
      withinTimeWindow,
      withinDailyLimit,
      legalReviewConfirmed,
      callerIdVerified,
      aiIdentificationPresent,
    },
    reasons,
  };
}
