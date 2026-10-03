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

        // Nabrah: per-agent token in the URL (Nabrah does not document a signature).
        if (provider === "nabrah") {
          const url = new URL(request.url);
          const agentId = url.searchParams.get("agent") ?? "";
          const token = url.searchParams.get("token") ?? "";
          const { verifyAgentWebhookToken } = await import("@/lib/nabrah.server");
          if (!/^[0-9a-f-]{36}$/i.test(agentId) || !verifyAgentWebhookToken(agentId, token)) {
            return new Response("Invalid token", { status: 401 });
          }
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(body);
          } catch {
            return Response.json({ error: "invalid_json" }, { status: 400 });
          }
          const call = (payload["call"] ?? payload["data"] ?? payload) as Record<string, unknown>;
          const eventType = String(payload["event"] ?? payload["type"] ?? "call");
          const externalId = `${String(call["call_id"] ?? call["id"] ?? call["session_id"] ?? Date.now())}:${eventType}`;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: existing } = await supabaseAdmin
            .from("webhook_events").select("id")
            .eq("provider", "nabrah").eq("external_event_id", externalId).maybeSingle();
          if (existing) return Response.json({ ok: true, duplicate: true });
          const { data: ev, error } = await supabaseAdmin
            .from("webhook_events")
            .insert({ provider: "nabrah", event_type: eventType, external_event_id: externalId, status: "received", payload: payload as never, provider_ref: agentId })
            .select("id").single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          const { ingestNabrahCall } = await import("@/lib/nabrah-ingest.server");
          const result = await ingestNabrahCall(agentId, payload);
          await supabaseAdmin.from("webhook_events").update({
            status: result.ok ? "processed" : "failed",
            company_id: result.companyId ?? null,
            error: result.ok ? null : (result.reason ?? "unknown_error"),
            processed_at: new Date().toISOString(),
          }).eq("id", ev.id);
          return Response.json({ ok: true, processed: result.ok });
        }

        const secret =
          provider === "whatsapp" ? process.env["WHATSAPP_WEBHOOK_SECRET"] : undefined;

        if (!secret) {
          return Response.json({ error: "provider_not_configured" }, { status: 503 });
        }

        const header =
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

        // WhatsApp Cloud messages become conversations + AI replies.
        if (provider === "whatsapp" && payload["entry"]) {
          const { ingestWhatsappMessage } = await import("@/lib/whatsapp-ingest.server");
          const result = await ingestWhatsappMessage(payload);
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
