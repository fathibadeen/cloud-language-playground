import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(db: any, companyId: string, userId: string, action: string, entity: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await db.from("audit_logs").insert({ company_id: companyId, user_id: userId, action, entity, entity_id: entityId, metadata });
}

function chunk(text: string): string[] {
  const parts: string[] = [];
  let buffer = "";
  for (const p of text.trim().split(/\n{2,}/)) {
    if ((buffer + "\n\n" + p).length > 900 && buffer) { parts.push(buffer.trim()); buffer = p; }
    else buffer = buffer ? `${buffer}\n\n${p}` : p;
  }
  if (buffer.trim()) parts.push(buffer.trim());
  return parts.filter(Boolean).slice(0, 200);
}

async function reprocess(db: any, doc: { id: string; company_id: string; content: string | null }) {
  await db.from("knowledge_chunks").delete().eq("document_id", doc.id);
  const pieces = chunk(doc.content ?? "");
  if (pieces.length) {
    await db.from("knowledge_chunks").insert(pieces.map((content, i) => ({ company_id: doc.company_id, document_id: doc.id, chunk_index: i, content })));
  }
  await db.from("knowledge_documents").update({ status: pieces.length ? "ready" : "failed" }).eq("id", doc.id);
}

const idSchema = z.object({ companyId: z.string().uuid() });

export const getCompanyDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const id = data.companyId;
    const [company, sub, customers, kbs, docs, agents, convs, calls, members, logs] = await Promise.all([
      db.from("companies").select("*").eq("id", id).maybeSingle(),
      db.from("subscriptions").select("status, plan_id, current_period_end, plans(name_ar, name_en, price_sar)").eq("company_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("customers").select("id, full_name, phone, email, created_at").eq("company_id", id).order("created_at", { ascending: false }).limit(500),
      db.from("knowledge_bases").select("id, name").eq("company_id", id),
      db.from("knowledge_documents").select("id, title, status, content, knowledge_base_id, created_at").eq("company_id", id).order("created_at", { ascending: false }),
      db.from("ai_agents").select("id, name, channel, language, is_active, greeting, system_instructions, provider_status").eq("company_id", id).order("created_at"),
      db.from("conversations").select("id, channel, status, subject, last_message_at, created_at, customers(full_name, phone)").eq("company_id", id).order("created_at", { ascending: false }).limit(100),
      db.from("voice_calls").select("id, direction, from_number, to_number, status, duration_seconds, created_at").eq("company_id", id).order("created_at", { ascending: false }).limit(100),
      db.from("company_members").select("id, role, user_id, invited_email, created_at").eq("company_id", id),
      db.from("audit_logs").select("id, action, entity, created_at, metadata").eq("company_id", id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (company.error) throw new Error(company.error.message);
    if (!company.data) throw new Error("company_not_found");
    const userIds = (members.data ?? []).map((m) => m.user_id);
    const profiles = userIds.length ? (await db.from("profiles").select("id, full_name, email").in("id", userIds)).data ?? [] : [];
    return {
      company: company.data,
      subscription: sub.data,
      customers: customers.data ?? [],
      knowledgeBases: kbs.data ?? [],
      documents: docs.data ?? [],
      agents: agents.data ?? [],
      conversations: conversations(convs.data),
      calls: calls.data ?? [],
      members: (members.data ?? []).map((m) => ({ ...m, profile: profiles.find((p) => p.id === m.user_id) ?? null })),
      logs: logs.data ?? [],
    };
  });

function conversations(rows: any[] | null) {
  return (rows ?? []).map((r) => ({ ...r, customers: r.customers ?? null })) as {
    id: string; channel: string; status: string; subject: string | null; last_message_at: string | null; created_at: string;
    customers: { full_name: string | null; phone: string | null } | null;
  }[];
}

export const getConversationMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid(), conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const { data: rows, error } = await db.from("messages").select("id, sender, body, created_at").eq("company_id", data.companyId).eq("conversation_id", data.conversationId).order("created_at").limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const opt = z.string().max(2000).nullable();

export const updateCompanyInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    companyId: z.string().uuid(),
    name: z.string().min(1).max(200),
    cr_number: opt, industry: opt, city: opt, address: opt, website: opt, contact_phone: opt, contact_email: opt, description: opt,
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const { companyId, ...fields } = data;
    const { error } = await db.from("companies").update(fields).eq("id", companyId);
    if (error) throw new Error(error.message);
    await audit(db, companyId, context.userId, "company.updated_by_admin", "companies", companyId);
    return { ok: true };
  });

export const upsertCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid(), id: z.string().uuid().nullable(), full_name: opt, phone: opt, email: opt }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const { companyId, id, ...fields } = data;
    const res = id
      ? await db.from("customers").update(fields).eq("id", id).eq("company_id", companyId).select("id").single()
      : await db.from("customers").insert({ company_id: companyId, ...fields }).select("id").single();
    if (res.error) throw new Error(res.error.message);
    await audit(db, companyId, context.userId, id ? "customer.updated_by_admin" : "customer.created_by_admin", "customers", res.data.id);
    return { ok: true };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const { error } = await db.from("customers").delete().eq("id", data.id).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    await audit(db, data.companyId, context.userId, "customer.deleted_by_admin", "customers", data.id);
    return { ok: true };
  });

export const upsertKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid(), id: z.string().uuid().nullable(), title: z.string().min(1).max(300), content: z.string().max(200000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    let docId = data.id;
    if (docId) {
      const { error } = await db.from("knowledge_documents").update({ title: data.title, content: data.content, status: "processing" }).eq("id", docId).eq("company_id", data.companyId);
      if (error) throw new Error(error.message);
    } else {
      let { data: kb } = await db.from("knowledge_bases").select("id").eq("company_id", data.companyId).limit(1).maybeSingle();
      if (!kb) {
        const created = await db.from("knowledge_bases").insert({ company_id: data.companyId, name: "قاعدة معرفة الشركة" }).select("id").single();
        if (created.error) throw new Error(created.error.message);
        kb = created.data;
      }
      const ins = await db.from("knowledge_documents").insert({ company_id: data.companyId, knowledge_base_id: kb!.id, title: data.title, content: data.content, source_type: "text", status: "processing" }).select("id").single();
      if (ins.error) throw new Error(ins.error.message);
      docId = ins.data.id;
    }
    await reprocess(db, { id: docId!, company_id: data.companyId, content: data.content });
    await audit(db, data.companyId, context.userId, data.id ? "document.updated_by_admin" : "document.created_by_admin", "knowledge_documents", docId);
    return { ok: true };
  });

export const deleteKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    await db.from("knowledge_chunks").delete().eq("document_id", data.id).eq("company_id", data.companyId);
    const { error } = await db.from("knowledge_documents").delete().eq("id", data.id).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    await audit(db, data.companyId, context.userId, "document.deleted_by_admin", "knowledge_documents", data.id);
    return { ok: true };
  });

export const reprocessKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const { data: doc } = await db.from("knowledge_documents").select("id, company_id, content").eq("id", data.id).eq("company_id", data.companyId).maybeSingle();
    if (!doc) throw new Error("document_not_found");
    await reprocess(db, doc);
    return { ok: true };
  });

export const updateAgentByAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid(), id: z.string().uuid(), is_active: z.boolean(), greeting: opt, system_instructions: z.string().max(20000).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const db = await admin();
    const { companyId, id, ...fields } = data;
    const { error } = await db.from("ai_agents").update(fields).eq("id", id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    await audit(db, companyId, context.userId, "agent.updated_by_admin", "ai_agents", id);
    return { ok: true };
  });
