import { createFileRoute } from "@tanstack/react-router";

/**
 * Sawti Growth — independent cron endpoint (Phase 3).
 *
 * Does NOT touch the existing /api/cron/$job registry (zero changes to
 * Sawti files). Uses the SAME authenticateCronRequest HMAC helper, so
 * the existing LOVABLE_CRON_SECRET works unchanged.
 *
 * Schedule recommendation: every 5 minutes.
 *   POST /api/cron/growth?job=campaign-runner
 */
export const Route = createFileRoute("/api/cron/growth")({
  beforeLoad: () => {
    throw new Error("Client access forbidden");
  },
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const job = String(params.job ?? "campaign-runner");
        if (job !== "campaign-runner") {
          return Response.json({ error: "unknown_growth_job", job }, { status: 404 });
        }

        const { runGrowthCampaignScheduler } = await import("@/lib/growth/campaign-scheduler");
        const result = await runGrowthCampaignScheduler();
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
      GET: async ({ request, params }) => {
        // Identical for cron providers that use GET
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const job = String(params.job ?? "campaign-runner");
        if (job !== "campaign-runner") {
          return Response.json({ error: "unknown_growth_job", job }, { status: 404 });
        }

        const { runGrowthCampaignScheduler } = await import("@/lib/growth/campaign-scheduler");
        const result = await runGrowthCampaignScheduler();
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
