/**
 * Pulls WhatsApp conversations from the voice/WhatsApp provider's omnichannel
 * inboxes into Sawti's conversations/messages tables. Idempotent: rows are keyed
 * by provider ids, so repeated runs only add what is new. The provider's list
 * endpoint returns each conversation's latest messages, not full history.
 */
type J = Record<string, any>;

export function mapOmniSender(m: J): "customer" | "ai" | "human" | null {
  if (m.message_type === 0) return "customer";
  if (m.message_type === 1) return m.sender_type === "User" ? "human" : "ai";
  return null; // activity/system notes are skipped
}

export async function syncOmniWhatsapp() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const nabrah = await import("@/lib/nabrah.server");
  if (!nabrah.nabrahConfigured()) return { ok: true, skipped: "not_configured" };
  const { data: accounts } = await db
    .from("whatsapp_accounts")
    .select("company_id, agent_id, webhook_verify_token")
    .eq("provider", "nabrah_omni").eq("is_active", true);
  let convs = 0, msgs = 0;
  for (const acc of accounts ?? []) {
    if (!acc.webhook_verify_token) continue;
    for (let page = 1; page <= 10; page++) {
      let res: J;
      try { res = (await nabrah.filterWhatsappConversations(acc.webhook_verify_token, page)) as J; }
      catch (e) { console.error("[wa-sync]", (e as Error).message); break; }
      const list: J[] = res?.payload ?? [];
      for (const c of list) {
        const contact = c.meta?.sender ?? {};
        const phone = String(contact.phone_number ?? "");
        let customerId: string | null = null;
        if (phone) {
          const { data: cu } = await db.from("customers").select("id")
            .eq("company_id", acc.company_id).eq("phone", phone).maybeSingle();
          customerId = cu?.id ?? null;
          if (!customerId) {
            const { data: ins } = await db.from("customers")
              .insert({ company_id: acc.company_id, phone, full_name: contact.name || null })
              .select("id").single();
            customerId = ins?.id ?? null;
          }
        }
        const ext = `omni:${c.uuid ?? c.id}`;
        const lastAt = new Date(Number(c.last_activity_at ?? c.timestamp) * 1000).toISOString();
        const status = c.status === "resolved" ? "closed" : "open";
        const { data: existing } = await db.from("conversations").select("id")
          .eq("company_id", acc.company_id).eq("external_id", ext).maybeSingle();
        let convId = existing?.id as string | undefined;
        if (convId) {
          await db.from("conversations").update({ last_message_at: lastAt }).eq("id", convId);
        } else {
          const { data: nc, error } = await db.from("conversations").insert({
            company_id: acc.company_id, customer_id: customerId, agent_id: acc.agent_id,
            channel: "whatsapp", status, external_id: ext,
            subject: contact.name || phone || "واتساب", last_message_at: lastAt,
            created_at: new Date(Number(c.created_at) * 1000).toISOString(),
          }).select("id").single();
          if (error) { console.error("[wa-sync] conv", error.message); continue; }
          convId = nc.id; convs++;
        }
        const pool = [c.last_non_activity_message, ...(c.messages ?? [])].filter(Boolean) as J[];
        const seen = new Set<string>();
        for (const m of pool) {
          const sender = mapOmniSender(m);
          const mid = `omni:${m.id}`;
          if (!sender || seen.has(mid) || !m.content) continue;
          seen.add(mid);
          const { data: dup } = await db.from("messages").select("id")
            .eq("conversation_id", convId!).eq("external_id", mid).maybeSingle();
          if (dup) continue;
          const { error } = await db.from("messages").insert({
            company_id: acc.company_id, conversation_id: convId!, sender, channel: "whatsapp",
            body: String(m.content), status: String(m.status ?? "sent"), external_id: mid,
            metadata: { source: "nabrah_omni" },
            created_at: new Date(Number(m.created_at) * 1000).toISOString(),
          });
          if (!error) msgs++;
        }
      }
      if (list.length < 25) break;
    }
  }
  return { ok: true, conversations: convs, messages: msgs };
}
