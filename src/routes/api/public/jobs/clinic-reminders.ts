import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/clinic-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runJob } = await import("@/lib/jobs/registry");
        const result = await runJob("clinic-reminders");
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
