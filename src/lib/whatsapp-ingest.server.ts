/**
 * Turns a verified Meta/WhatsApp Cloud webhook payload into platform rows
 * (customer + conversation + messages + usage) and answers with the company's
 * AI agent. Server-only: the caller must have verified the signature first.
 */

type Json = Record<string, unknown>;

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

function firstMessage(payload: Json) {
  const entry = (payload["entry"] as Json[] | undefined)?.[0];
  const change = (entry?.["changes"] as Json[] | undefined)?.[0];
  const value = change?.["value"] as Json | undefined;
  const message = (value?.["messages"] as Json[] | undefined)?.[0];
  const contact = (value?.["contacts"] as Json[] | undefined)?.[0];
  const metadata = value?.["metadata"] as Json | undefined;
  if (!message) return null;
  return {
    waId: String(message["from"] ?? ""),
    externalId: String(message["id"] ?? ""),
    text: String(((message["text"] as Json | undefined)?.["body"] as string) ?? ""),
    name: String(((contact?.["profile"] as Json | undefined)?.["name"] as string) ?? ""),
    businessNumber: String(metadata?.["display_phone_number"] ?? ""),
    phoneNumberId: String(metadata?.["phone_number_id"] ?? ""),
  };
}

async function generateReply(
  instructions: string,
  knowledge: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const system = [instructions, knowledge ? `\n\nمعلومات الشركة:\n${knowledge}` : ""].join("");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: "system", content: system }, ...history],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

async function sendWhatsapp(phoneNumberId: string, to: string, body: string): Promise<boolean> {
  const key = process.env["WHATSAPP_API_KEY"];
  if (!key || !phoneNumberId) return false;
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  return res.ok;
}

export async function ingestWhatsappMessage(
  payload: Json,
): Promise<{ ok: boolean; reason?: string; companyId?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const msg = firstMessage(payload);
  if (!msg) return { ok: true, reason: "no_message" };

  let query = supabaseAdmin
    .from("whatsapp_accounts")
    .select("id, company_id, agent_id, phone_number, business_account_id")
    .limit(1);
  query = msg.businessNumber
    ? query.eq("phone_number", msg.businessNumber)
    : query.eq("business_account_id", msg.phoneNumberId);
  const { data: account } = await query.maybeSingle();
  if (!account) return { ok: false, reason: "unknown_whatsapp_account" };

  const companyId = account.company_id;

  const { data: active } = await supabaseAdmin.rpc("company_is_active", {
    _company_id: companyId,
  });

  // customer
  let customerId: string | null = null;
  const { data: existingCustomer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("company_id", companyId)
    .eq("phone", msg.waId)
    .maybeSingle();
  if (existingCustomer) customerId = existingCustomer.id;
  else {
    const { data: created } = await supabaseAdmin
      .from("customers")
      .insert({ company_id: companyId, phone: msg.waId, full_name: msg.name || null })
      .select("id")
      .single();
    customerId = created?.id ?? null;
  }

  // conversation
  let conversationId: string | null = null;
  const { data: openConversation } = await supabaseAdmin
    .from("conversations")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("channel", "whatsapp")
    .eq("customer_id", customerId ?? "")
    .in("status", ["open", "needs_human", "human"])
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (openConversation) conversationId = openConversation.id;
  else {
    const { data: created, error } = await supabaseAdmin
      .from("conversations")
      .insert({
        company_id: companyId,
        customer_id: customerId,
        agent_id: account.agent_id,
        channel: "whatsapp",
        status: "open",
        external_id: msg.waId,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return { ok: false, reason: error.message, companyId };
    conversationId = created.id;
  }

  // inbound message (idempotent on the provider message id)
  const { data: dupe } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("company_id", companyId)
    .eq("external_id", msg.externalId)
    .maybeSingle();
  if (dupe) return { ok: true, companyId };

  await supabaseAdmin.from("messages").insert({
    company_id: companyId,
    conversation_id: conversationId,
    sender: "customer",
    channel: "whatsapp",
    body: msg.text,
    external_id: msg.externalId,
    status: "received",
  });
  await supabaseAdmin.from("usage_records").insert({
    company_id: companyId,
    metric: "whatsapp_messages",
    quantity: 1,
    unit: "message",
    reference_id: conversationId,
  });

  if (!active || openConversation?.status === "human") {
    return { ok: true, companyId };
  }

  // agent + knowledge context
  const { data: agent } = await supabaseAdmin
    .from("ai_agents")
    .select("id, system_instructions, greeting, fallback_response, knowledge_base_id, is_active")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!agent) return { ok: true, companyId };

  const { data: chunks } = await supabaseAdmin
    .from("knowledge_chunks")
    .select("content")
    .eq("company_id", companyId)
    .limit(12);
  const knowledge = (chunks ?? []).map((c) => c.content).join("\n---\n").slice(0, 6000);

  const { data: history } = await supabaseAdmin
    .from("messages")
    .select("sender, body")
    .eq("conversation_id", conversationId!)
    .order("created_at", { ascending: false })
    .limit(10);

  const turns = (history ?? [])
    .reverse()
    .filter((m) => !!m.body)
    .map((m) => ({
      role: (m.sender === "customer" ? "user" : "assistant") as "user" | "assistant",
      content: m.body as string,
    }));

  const reply =
    (await generateReply(
      agent.system_instructions ?? "أنت موظف خدمة عملاء سعودي محترف. أجب بإيجاز وباللهجة المهذبة.",
      knowledge,
      turns,
    )) ?? agent.fallback_response;

  if (!reply) {
    await supabaseAdmin
      .from("conversations")
      .update({ status: "needs_human", last_message_at: new Date().toISOString() })
      .eq("id", conversationId!);
    return { ok: true, companyId };
  }

  const sent = await sendWhatsapp(msg.phoneNumberId, msg.waId, reply);

  await supabaseAdmin.from("messages").insert({
    company_id: companyId,
    conversation_id: conversationId,
    sender: "ai",
    channel: "whatsapp",
    body: reply,
    status: sent ? "sent" : "failed",
  });
  await supabaseAdmin.from("usage_records").insert({
    company_id: companyId,
    metric: "whatsapp_messages",
    quantity: 1,
    unit: "message",
    reference_id: conversationId,
  });
  await supabaseAdmin
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId!);

  return { ok: true, companyId };
}
