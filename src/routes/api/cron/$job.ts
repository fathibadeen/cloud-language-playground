import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/$job")({
  beforeLoad: () => {
    throw new Error("Client access forbidden");
  },
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const { runJob, isJobName } = await import("@/lib/jobs/registry");

        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const job = String(params.job ?? "");
        if (!isJobName(job)) {
          return Response.json({ error: "unknown_job", job }, { status: 404 });
        }

        const result = await runJob(job);
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
      GET: async ({ request, params }) => {
        // Same implementation for cron systems that use GET
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const { runJob, isJobName } = await import("@/lib/jobs/registry");

        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const job = String(params.job ?? "");
        if (!isJobName(job)) {
          return Response.json({ error: "unknown_job", job }, { status: 404 });
        }

        const result = await runJob(job);
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
