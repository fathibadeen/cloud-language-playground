import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

// Payload is never trusted: we only extract the invoice id, then applyInvoice
// re-fetches the invoice from Moyasar and checks status + amount itself.
export const Route = createFileRoute("/api/public/webhooks/moyasar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { loadMoyasarSettings, applyInvoice } = await import("@/lib/moyasar.server");
        const s = await loadMoyasarSettings();
        const secret = s?.webhook_secret ?? "";
        if (!secret) return new Response("forbidden", { status: 403 });

        const body = (await request.json().catch(() => null)) as {
          secret_token?: unknown;
          id?: unknown;
          data?: { id?: unknown; invoice_id?: unknown };
        } | null;
        const urlKey = new URL(request.url).searchParams.get("key") ?? "";
        const token = typeof body?.secret_token === "string" ? body.secret_token : "";

        // Reject only a wrong token; accept a valid URL key or a valid body token.
        if (token && !safeEqual(token, secret)) {
          console.error("[moyasar webhook] wrong secret_token");
          return new Response("forbidden", { status: 403 });
        }
        if (!(urlKey && safeEqual(urlKey, secret)) && !token) {
          return new Response("forbidden", { status: 403 });
        }

        const candidates = [body?.data?.invoice_id, body?.data?.id, body?.id];
        const invoiceId = candidates.find((v) => typeof v === "string" && ID_RE.test(v));
        if (!invoiceId) return new Response("ignored", { status: 200 });

        try {
          await applyInvoice(invoiceId);
        } catch (e) {
          console.error("[moyasar webhook]", e);
          return new Response("retry", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
