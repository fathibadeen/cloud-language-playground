import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CHUNK_SIZE = 900;

function chunk(text: string): string[] {
  const clean = text.replace(/\s+\n/g, "\n").trim();
  const parts: string[] = [];
  let buffer = "";
  for (const paragraph of clean.split(/\n{2,}/)) {
    if ((buffer + "\n\n" + paragraph).length > CHUNK_SIZE && buffer) {
      parts.push(buffer.trim());
      buffer = paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }
  if (buffer.trim()) parts.push(buffer.trim());
  return parts.filter(Boolean).slice(0, 200);
}

/**
 * Splits a knowledge document into searchable chunks the AI agent can use.
 * Runs as the signed-in user first (RLS proves they may read the document),
 * then writes chunks with the service-role client.
 */
export const processKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("knowledge_documents")
      .select("id, company_id, content, source_url, title")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("document_not_found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let text = doc.content ?? "";
    if (!text && doc.source_url) {
      try {
        const res = await fetch(doc.source_url);
        if (res.ok) {
          const html = await res.text();
          text = html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .slice(0, 50000);
        }
      } catch {
        text = "";
      }
    }

    if (!text.trim()) {
      await supabaseAdmin
        .from("knowledge_documents")
        .update({ status: "failed" })
        .eq("id", doc.id);
      return { ok: false as const, chunks: 0 };
    }

    await supabaseAdmin.from("knowledge_chunks").delete().eq("document_id", doc.id);

    const pieces = chunk(text);
    const rows = pieces.map((content, index) => ({
      company_id: doc.company_id,
      document_id: doc.id,
      chunk_index: index,
      content,
      metadata: { title: doc.title },
    }));

    if (rows.length) {
      const { error: insertError } = await supabaseAdmin.from("knowledge_chunks").insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    await supabaseAdmin
      .from("knowledge_documents")
      .update({ status: "ready", content: text.slice(0, 100000) })
      .eq("id", doc.id);

    void context.userId;
    return { ok: true as const, chunks: rows.length };
  });
