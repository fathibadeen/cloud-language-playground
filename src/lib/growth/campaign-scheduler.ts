/**
 * Sawti Growth — Campaign scheduler (Phase 3)
 *
 * Runs ONLY via the Growth cron endpoint (server-side, HMAC-authenticated).
 * For every approved campaign it:
 *   1) verifies human approval exists (approval gate),
 *   2) creates call_jobs for approved leads only,
 *   3) paces jobs within the tenant daily limit,
 *   4) at dial time the compliance engine re-checks EVERY lead individually.
 *
 * The scheduler can never lift the kill switch and never bypasses consent.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evaluateOutreach } from "@/lib/growth/compliance";
import { executeCallJob } from "@/lib/growth/nabrah-calls";

const MAX_CAMPAIGNS_PER_RUN = 50;
const MAX_DIALS_PER_RUN = 25;

export type SchedulerResult = {
  ok: boolean;
  processed: number;
  errors: number;
  details?: Record<string, unknown>;
};

/**
 * Creates call_jobs for approved leads of approved campaigns. Idempotent:
 * a lead already queued for the campaign is never queued twice.
 */
export async function scheduleApprovedCampaigns(): Promise<SchedulerResult> {
  const started = Date.now();
  let processed = 0;
  let errors = 0;
  const details: Record<string, unknown> = { queued: 0, campaigns: 0, skipped: [] as string[] };

  try {
    // 1) Global kill switch — fail-closed
    const { data: flags } = await supabaseAdmin
      .from("growth_global_flags")
      .select("all_outreach_disabled")
      .eq("id", 1)
      .maybeSingle();
    if (flags?.all_outreach_disabled ?? true) {
      return { ok: true, processed: 0, errors: 0, details: { skipped_reason: "global_kill_switch_active" } };
    }

    // 2) Approved campaigns that are not yet running/paused
    const { data: campaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id, company_id, name, daily_limit, status, approved_at")
      .eq("status", "approved")
      .not("approved_at", "is", null)
      .limit(MAX_CAMPAIGNS_PER_RUN);

    for (const campaign of campaigns ?? []) {
      const { data: settings } = await supabaseAdmin
        .from("growth_settings")
        .select("campaigns_paused, daily_call_limit")
        .eq("company_id", campaign.company_id)
        .maybeSingle();
      if (settings?.campaigns_paused ?? true) {
        details.skipped.push(`campaign:${campaign.id}:tenant_paused`);
        continue;
      }

      // 3) Approved items for this campaign (human approval REQUIRED per lead)
      const { data: items } = await supabaseAdmin
        .from("approval_items")
        .select("id, lead_id")
        .eq("company_id", campaign.company_id)
        .eq("decision", "approved")
        .limit(500);

      if (!items?.length) {
        details.skipped.push(`campaign:${campaign.id}:no_approved_items`);
        continue;
      }

      // 4) Which of these leads already have a job for this campaign?
      const { data: existingJobs } = await supabaseAdmin
        .from("call_jobs")
        .select("lead_id")
        .eq("campaign_id", campaign.id)
        .in("lead_id", items.map((i) => i.lead_id));
      const alreadyQueued = new Set((existingJobs ?? []).map((j) => j.lead_id));

      // 5) Tenant daily limit — pace, never exceed
      const { count: usedToday } = await supabaseAdmin
        .from("growth_calls")
        .select("id", { count: "exact", head: true })
        .eq("company_id", campaign.company_id)
        .gte("created_at", startOfRiyadhDay());

      const tenantDailyLimit = settings?.daily_call_limit ?? 20;
      const remainingToday = Math.max(0, tenantDailyLimit - (usedToday ?? 0));
      if (remainingToday === 0) {
        details.skipped.push(`campaign:${campaign.id}:daily_limit_reached`);
        continue;
      }

      const budgetThisRun = Math.min(
        remainingToday,
        campaign.daily_limit ?? tenantDailyLimit,
        MAX_DIALS_PER_RUN,
      );

      const toQueue = items
        .filter((i) => !alreadyQueued.has(i.lead_id))
        .slice(0, budgetThisRun);

      let queued = 0;
      for (const item of toQueue) {
        const { error } = await supabaseAdmin.from("call_jobs").insert({
          company_id: campaign.company_id,
          campaign_id: campaign.id,
          lead_id: item.lead_id,
          approval_item_id: item.id,
          status: "queued",
          scheduled_for: new Date().toISOString(),
        });
        if (error) {
          errors++;
        } else {
          queued++;
          processed++;
        }
      }
      (details as { queued?: number }).queued = ((details as { queued?: number }).queued ?? 0) + queued;
      (details as { campaigns?: number }).campaigns = (((details as { campaigns?: number }).campaigns ?? 0) as number) + 1;

      // Move the campaign to running once jobs exist
      if (queued > 0) {
        await supabaseAdmin.from("campaigns").update({ status: "running" }).eq("id", campaign.id);
      }
    }

    return {
      ok: errors === 0,
      processed,
      errors,
      details: { ...details, ms: Date.now() - started },
    };
  } catch (e) {
    return {
      ok: false,
      processed,
      errors: errors + 1,
      details: { error: e instanceof Error ? e.message : String(e), ms: Date.now() - started },
    };
  }
}

function startOfRiyadhDay(): string {
  const now = new Date();
  const riyadh = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const dayStart = new Date(
    Date.UTC(riyadh.getFullYear(), riyadh.getMonth(), riyadh.getDate(), 0, 0, 0),
  );
  return dayStart.toISOString();
}

/**
 * Dials queued jobs. Each dial re-runs evaluateOutreach() for the individual
 * lead — approval alone is never sufficient (suppression/consent/window/
 * limit/legal/caller-id/AI-identification are all re-checked).
 */
export async function dialQueuedJobs(): Promise<SchedulerResult> {
  const started = Date.now();
  let processed = 0;
  let errors = 0;

  try {
    const { data: jobs } = await supabaseAdmin
      .from("call_jobs")
      .select("id")
      .eq("status", "queued")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(MAX_DIALS_PER_RUN);

    for (const job of jobs ?? []) {
      const res = await executeCallJob(job.id);
      processed++;
      if (!res.ok && !res.blocked) errors++;
    }

    return { ok: errors === 0, processed, errors, details: { ms: Date.now() - started } };
  } catch (e) {
    return {
      ok: false,
      processed,
      errors: errors + 1,
      details: { error: e instanceof Error ? e.message : String(e), ms: Date.now() - started },
    };
  }
}

/** Combined runner — one cron hit does schedule + dial. */
export async function runGrowthCampaignScheduler(): Promise<SchedulerResult> {
  const scheduleRes = await scheduleApprovedCampaigns();
  const dialRes = await dialQueuedJobs();
  return {
    ok: scheduleRes.ok && dialRes.ok,
    processed: scheduleRes.processed + dialRes.processed,
    errors: scheduleRes.errors + dialRes.errors,
    details: { schedule: scheduleRes.details, dial: dialRes.details },
  };
}

// Keep a reference so tree-shaking never drops the compliance import used by executeCallJob
void evaluateOutreach;
