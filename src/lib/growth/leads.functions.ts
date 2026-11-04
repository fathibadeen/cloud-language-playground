/**
 * Sawti Growth — Dashboard server functions (Phase 2)
 * Same pattern as existing *.functions.ts: createServerFn + zod +
 * requireSupabaseAuth middleware; RLS proves company membership.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------------- CSV import ---------------- */

export const importLeadsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      sourceName: z.string().min(1).max(120),
      rows: z
        .array(
          z.object({
            business_name: z.string().max(300),
            contact_name: z.string().max(300).optional(),
            contact_phone: z.string().min(9).max(20),
            contact_email: z.string().email().max(300).optional(),
            website: z.string().max(300).optional(),
            city: z.string().max(300).optional(),
            industry: z.string().max(300).optional(),
          }),
        )
        .min(1)
        .max(5000),
      consent: z.object({
        lawful_basis: z.enum(["explicit_consent", "existing_customer_contract", "legitimate_interest_b2b"]),
        purpose: z.string().min(3).max(400),
        source: z.string().min(3).max(400),
        evidence_text: z.string().max(2000).optional(),
        evidence_url: z.string().url().max(500).optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // The company_id is taken from the user's OWNED membership — never from
    // client input — so a member can only import into their own company.
    const { data: membership } = await context.supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", context.user.id)
      .limit(50);
    if (!membership?.length) throw new Error("Forbidden");

    const targetCompany = membership[0].company_id;
    const allowed = membership.find(
      (m) => m.company_id === targetCompany && ["owner", "admin", "agent"].includes(m.role),
    );
    if (!allowed) throw new Error("Forbidden: insufficient role");

    const { importCsvLeads } = await import("@/lib/growth/leads.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create the lead source row
    const { data: source } = await context.supabase
      .from("lead_sources")
      .insert({ company_id: targetCompany, name: data.sourceName, source_type: "csv_import" })
      .select("id")
      .single();
    if (!source) throw new Error("lead_source_create_failed");

    const result = await importCsvLeads(targetCompany, source.id, data.rows);

    // Consent evidence is MANDATORY per lead — the import is rejected when the
    // caller does not document the lawful basis (compliance rule).
    for (const leadId of result.lead_ids) {
      await supabaseAdmin.from("consent_records").insert({
        company_id: targetCompany,
        lead_id: leadId,
        channel: "call",
        lawful_basis: data.consent.lawful_basis,
        purpose: data.consent.purpose,
        source: data.consent.source,
        evidence_text: data.consent.evidence_text ?? null,
        evidence_url: data.consent.evidence_url ?? null,
        granted_at: new Date().toISOString(),
        created_by: context.user.id,
      });
      await supabaseAdmin.from("consent_records").insert({
        company_id: targetCompany,
        lead_id: leadId,
        channel: "whatsapp",
        lawful_basis: data.consent.lawful_basis,
        purpose: data.consent.purpose,
        source: data.consent.source,
        evidence_text: data.consent.evidence_text ?? null,
        evidence_url: data.consent.evidence_url ?? null,
        granted_at: new Date().toISOString(),
        created_by: context.user.id,
      });
    }

    return result;
  });

/* ---------------- Website discovery ---------------- */

export const discoverFromWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      sourceName: z.string().min(1).max(120),
      website: z.string().url().max(500),
      consent: z.object({
        lawful_basis: z.enum(["explicit_consent", "existing_customer_contract", "legitimate_interest_b2b"]),
        purpose: z.string().min(3).max(400),
        source: z.string().min(3).max(400),
        evidence_text: z.string().max(2000).optional(),
        evidence_url: z.string().url().max(500).optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", context.user.id)
      .limit(50);
    if (!membership?.length) throw new Error("Forbidden");
    const targetCompany = membership[0].company_id;
    const allowed = membership.find(
      (m) => m.company_id === targetCompany && ["owner", "admin", "agent"].includes(m.role),
    );
    if (!allowed) throw new Error("Forbidden: insufficient role");

    const { extractFromWebsite } = await import("@/lib/growth/leads.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const facts = await extractFromWebsite(data.website);
    if (!facts?.contact_phone) {
      return { ok: false as const, reason: "no_business_phone_found" };
    }

    const { data: source } = await context.supabase
      .from("lead_sources")
      .insert({
        company_id: targetCompany,
        name: data.sourceName,
        source_type: "website",
        config: { website: data.website } as never,
      })
      .select("id")
      .single();
    if (!source) throw new Error("lead_source_create_failed");

    const { importCsvLeads } = await import("@/lib/growth/leads.server");
    const result = await importCsvLeads(targetCompany, source.id, [
      {
        business_name: facts.business_name,
        contact_phone: facts.contact_phone,
        website: data.website,
        contact_name: facts.description?.slice(0, 120),
      },
    ]);

    for (const leadId of result.lead_ids) {
      await supabaseAdmin.from("consent_records").insert({
        company_id: targetCompany,
        lead_id: leadId,
        channel: "call",
        lawful_basis: data.consent.lawful_basis,
        purpose: data.consent.purpose,
        source: data.consent.source,
        evidence_text: data.consent.evidence_text ?? null,
        evidence_url: data.consent.evidence_url ?? null,
        granted_at: new Date().toISOString(),
        created_by: context.user.id,
      });
      await supabaseAdmin.from("consent_records").insert({
        company_id: targetCompany,
        lead_id: leadId,
        channel: "whatsapp",
        lawful_basis: data.consent.lawful_basis,
        purpose: data.consent.purpose,
        source: data.consent.source,
        evidence_text: data.consent.evidence_text ?? null,
        evidence_url: data.consent.evidence_url ?? null,
        granted_at: new Date().toISOString(),
        created_by: context.user.id,
      });
    }

    return { ok: true as const, ...result, facts };
  });

/* ---------------- Enrichment trigger ---------------- */

export const enrichLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ leadIds: z.array(z.string().uuid()).min(1).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Verify every requested lead belongs to the caller's company (RLS also
    // enforces this, but we fail fast with a clear error).
    for (const leadId of data.leadIds) {
      const { data: lead } = await context.supabase
        .from("leads")
        .select("id")
        .eq("id", leadId)
        .maybeSingle();
      if (!lead) throw new Error("Forbidden: lead not in your company");
    }

    const { enrichLeadsBatch } = await import("@/lib/growth/enrichment");
    // The platform's LLM provider is wired in a later phase; until then
    // enrichment returns an honest "provider_not_configured" per lead.

    const result = await enrichLeadsBatch(data.leadIds);
    return result;
  });

/* ---------------- Manual consent capture ---------------- */

export const addConsentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      leadId: z.string().uuid(),
      channel: z.enum(["call", "whatsapp"]),
      lawful_basis: z.enum(["explicit_consent", "existing_customer_contract", "legitimate_interest_b2b"]),
      purpose: z.string().min(3).max(400),
      source: z.string().min(3).max(400),
      evidence_text: z.string().max(2000).optional(),
      evidence_url: z.string().url().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: lead } = await context.supabase
      .from("leads")
      .select("id, company_id")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error("Forbidden: lead not in your company");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("consent_records").insert({
      company_id: lead.company_id,
      lead_id: lead.id,
      channel: data.channel,
      lawful_basis: data.lawful_basis,
      purpose: data.purpose,
      source: data.source,
      evidence_text: data.evidence_text ?? null,
      evidence_url: data.evidence_url ?? null,
      granted_at: new Date().toISOString(),
      created_by: context.user.id,
    });
    if (error) throw error;
    return { ok: true as const };
  });

/* ---------------- Suppression management ---------------- */

export const addSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      phone: z.string().min(9).max(20),
      reason: z.string().min(3).max(400),
      source: z.string().max(400).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", context.user.id)
      .limit(50);
    if (!membership?.length) throw new Error("Forbidden");
    const targetCompany = membership[0].company_id;
    const allowed = membership.find(
      (m) => m.company_id === targetCompany && ["owner", "admin"].includes(m.role),
    );
    if (!allowed) throw new Error("Forbidden: owner/admin only");

    const { normalizePhone } = await import("@/lib/growth/compliance");
    const normalized = normalizePhone(data.phone);

    // Tenant-scoped suppression (global rows are service_role only)
    const { error } = await context.supabase.from("suppression_list").insert({
      company_id: targetCompany,
      phone: normalized,
      reason: data.reason,
      source: data.source ?? "manual",
      created_by: context.user.id,
    });
    if (error) throw error;
    return { ok: true as const, phone: normalized };
  });
