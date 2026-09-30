import { createFileRoute } from "@tanstack/react-router";
import { buildIcs } from "@/lib/appointments.server";

/**
 * Read-only iCalendar feed for one company, addressed by its secret booking
 * token so Google Calendar / Apple Calendar can subscribe to it.
 */
export const Route = createFileRoute("/api/public/calendar/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "").replace(/\.ics$/, "");
        if (!/^[a-f0-9]{16,64}$/i.test(token)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("booking_settings")
          .select("company_id, companies(name)")
          .eq("calendar_token", token)
          .maybeSingle();
        if (!settings) return new Response("Not found", { status: 404 });

        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: rows } = await supabaseAdmin
          .from("appointments")
          .select("id, start_time, end_time, customer_name, customer_phone, service_name, notes, status")
          .eq("company_id", settings.company_id)
          .gte("start_time", since)
          .order("start_time", { ascending: true })
          .limit(1000);

        const name = (settings.companies as { name?: string } | null)?.name ?? "Sawti";
        return new Response(buildIcs(rows ?? [], name), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
