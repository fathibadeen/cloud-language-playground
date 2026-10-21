import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  secret_token: z.string().max(500).optional(),
  type: z.string().max(100).optional(),
  data: z.object({ invoice_id: z.string().max(100).nullable().optional() }).passthrough().optional(),
});

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/webhooks/moyasar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("bad request", { status: 400 });
        const { loadMoyasarSettings, applyInvoice } = await import("@/lib/moyasar.server");
        const s = await loadMoyasarSettings();
        const token = parsed.data.secret_token ?? "";
        if (!s?.webhook_secret || !safeEqual(token, s.webhook_secret)) {
          return new Response("unauthorized", { status: 401 });
        }
        const invoiceId = parsed.data.data?.invoice_id;
        if (invoiceId) {
          try {
            await applyInvoice(invoiceId);
          } catch (e) {
            console.error("[moyasar webhook]", e);
            return new Response("retry", { status: 500 });
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
