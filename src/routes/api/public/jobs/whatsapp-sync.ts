import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/whatsapp-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { syncOmniWhatsapp } = await import("@/lib/whatsapp-omni-sync.server");
        return Response.json(await syncOmniWhatsapp());
      },
    },
  },
});
