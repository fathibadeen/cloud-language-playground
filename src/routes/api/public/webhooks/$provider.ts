import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Centralised webhook receiver: /api/public/webhooks/{provider}
 *
 * - verifies the provider signature before touching any data
 * - stores the raw payload in webhook_events
 * - idempotent: a repeated external event id is ignored (unique constraint)
 */
export const Route = createFileRoute("/api/public/webhooks/$provider")({
  server: {
    handlers: {
      // Meta/WhatsApp subscription verification handshake
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env["WHATSAPP_VERIFY_TOKEN"];
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request, params }) => {
        const provider = String(params.provider);
        const body = await request.text();

        const secret =
          provider === "retell"
            ? process.env["RETELL_WEBHOOK_SECRET"]
            : provider === "whatsapp"
              ? process.env["WHATSAPP_WEBHOOK_SECRET"]
              : undefined;

        if (!secret) {
          return Response.json({ error: "provider_not_configured" }, { status: 503 });
        }

        const header =
          request.headers.get("x-retell-signature") ??
          request.headers.get("x-hub-signature-256") ??
          request.headers.get("x-webhook-signature") ??
          "";
        const received = header.replace(/^sha256=/, "");
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const a = Buffer.from(received);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(body);
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const eventType =
          (payload["event"] as string) ?? (payload["type"] as string) ?? "unknown";
        const externalId =
          (payload["event_id"] as string) ??
          (payload["id"] as string) ??
          `${provider}:${eventType}:${Date.now()}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: existing } = await supabaseAdmin
          .from("webhook_events")
          .select("id, status")
          .eq("provider", provider)
          .eq("external_event_id", externalId)
          .maybeSingle();

        if (existing) {
          return Response.json({ ok: true, duplicate: true });
        }

        const { data: eventRow, error } = await supabaseAdmin
          .from("webhook_events")
          .insert({
            provider,
            event_type: eventType,
            external_event_id: externalId,
            status: "received",
            payload: payload as never,
          })
          .select("id")
          .single();
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        // Retell call events become real call records.
        if (provider === "retell" && payload["call"]) {
          const { ingestRetellCall } = await import("@/lib/retell-ingest.server");
          const result = await ingestRetellCall(
            payload["call"] as Parameters<typeof ingestRetellCall>[0],
          );
          await supabaseAdmin
            .from("webhook_events")
            .update({
              status: result.ok ? "processed" : "failed",
              company_id: result.companyId ?? null,
              error: result.ok ? null : (result.reason ?? "unknown_error"),
              processed_at: new Date().toISOString(),
            })
            .eq("id", eventRow.id);
          return Response.json({ ok: true, processed: result.ok });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
