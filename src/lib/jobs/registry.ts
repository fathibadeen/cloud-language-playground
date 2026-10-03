/**
 * Centralized job registry with audit logging
 * Each job exports: run(): Promise<{ processed, errors, details }>
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const JOB_NAMES = [
  "webhook-retry",
  "nabrah-reconcile",
  "usage-alerts",
  "subscription-cycle",
  "sla-escalation",
  "conversation-janitor",
  "retention"
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value);
}

export type JobResult = {
  job: string;
  ok: boolean;
  processed: number;
  errors: number;
  ms: number;
  details?: Record<string, unknown>;
};

export async function runJob(name: JobName): Promise<JobResult> {
  const started = Date.now();
  let result: { processed: number; errors: number; details?: Record<string, unknown> };

  try {
    switch (name) {
      case "webhook-retry":
        result = await (await import("./webhook-retry")).run();
        break;
      case "nabrah-reconcile":
        result = await (await import("./nabrah-reconcile")).run();
        break;
      case "usage-alerts":
        result = await (await import("./usage-alerts")).run();
        break;
      case "subscription-cycle":
        result = await (await import("./subscription-cycle")).run();
        break;
      case "sla-escalation":
        result = await (await import("./sla-escalation")).run();
        break;
      case "conversation-janitor":
        result = await (await import("./conversation-janitor")).run();
        break;
      case "retention":
        result = await (await import("./retention")).run();
        break;
    }

    const ms = Date.now() - started;
    const jobResult: JobResult = { job: name, ok: result.errors === 0, ...result, ms };

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      action: "cron_run",
      entity: "cron",
      entity_id: name,
      company_id: null,
      metadata: jobResult,
    });

    return jobResult;
  } catch (error) {
    const ms = Date.now() - started;
    const jobResult: JobResult = {
      job: name,
      ok: false,
      processed: 0,
      errors: 1,
      ms,
      details: { error: error instanceof Error ? error.message : String(error) },
    };

    await supabaseAdmin.from("audit_logs").insert({
      action: "cron_run",
      entity: "cron",
      entity_id: name,
      company_id: null,
      metadata: jobResult,
    });

    return jobResult;
  }
}
