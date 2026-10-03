/**
 * A7: conversation-janitor job
 * Summarize and archive conversations resolved >7 days ago
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ARCHIVE_THRESHOLD_DAYS = 7;

export async function run() {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - ARCHIVE_THRESHOLD_DAYS);

  const { data: resolved } = await supabaseAdmin
    .from("conversations")
    .select("id, company_id")
    .eq("status", "closed")
    .is("summary", null)
    .lte("last_message_at", threshold.toISOString())
    .limit(100);

  let processed = 0;
  let errors = 0;

  for (const conv of resolved || []) {
    try {
      // Fetch messages for summarization
      const { data: messages } = await supabaseAdmin
        .from("messages")
        .select("body, sender")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });

      // Simple summary: first customer message + resolution indicator
      const customerMsg = messages?.find((m) => m.sender === "customer")?.body;
      const summary = customerMsg
        ? `${customerMsg.slice(0, 100)}... [Resolved]`
        : "[Resolved conversation]";

      await supabaseAdmin
        .from("conversations")
        .update({ summary })
        .eq("id", conv.id);

      processed++;
    } catch (error) {
      errors++;
      console.error(`[conversation-janitor] Conversation ${conv.id}:`, error);
    }
  }

  return { processed, errors, details: { archived: processed } };
}
