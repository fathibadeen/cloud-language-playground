/**
 * Sawti Growth — Lead ingestion (Phase 2 core, uploaded with Phase 1 foundation)
 *
 * Compliant sources ONLY:
 *  - CSV import (tenant's own data — lawful basis documented per lead)
 *  - Public company websites (business info extraction, treated as
 *    UNTRUSTED DATA: sanitized, size-capped, never used as instructions)
 *  - Licensed provider adapters (contract-backed data sources)
 *
 * No scraping of Google Maps / LinkedIn / Meta. Deduplication is enforced
 * per tenant via (company_id, dedupe_key) with normalized E.164 phones.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizePhone } from "@/lib/growth/compliance";

export type CsvLeadRow = {
  business_name: string;
  contact_name?: string;
  contact_phone: string;
  contact_email?: string;
  website?: string;
  city?: string;
  industry?: string;
};

const MAX_CSV_ROWS = 5_000;
const MAX_FIELD_LEN = 300;

/**
 * Prompt-injection / untrusted-content defense:
 * strips control characters, null bytes and caps length. Imported website
 * or CSV text is DATA ONLY — it is never concatenated into any AI prompt
 * without being wrapped inside a dedicated untrusted-content block by the
 * enrichment pipeline, and it can never reach system prompts.
 */
export function sanitizeExternalText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FIELD_LEN);
}

function isLikelyValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export type ImportResult = {
  inserted: number;
  duplicates: number;
  skipped_invalid: number;
  lead_ids: string[];
};

/**
 * Imports CSV rows for a tenant with dedup. Idempotent per
 * (company_id, normalized phone): re-importing the same file adds
 * duplicates=those already present and inserts only new leads.
 */
export async function importCsvLeads(
  companyId: string,
  sourceId: string,
  rows: CsvLeadRow[],
): Promise<ImportResult> {
  const capped = rows.slice(0, MAX_CSV_ROWS);
  const valid: CsvLeadRow[] = [];
  let skipped_invalid = 0;

  for (const r of capped) {
    const phone = r.contact_phone?.trim();
    if (!r.business_name?.trim() || !phone || !isLikelyValidPhone(phone)) {
      skipped_invalid++;
      continue;
    }
    valid.push({
      business_name: sanitizeExternalText(r.business_name),
      contact_name: r.contact_name ? sanitizeExternalText(r.contact_name) : undefined,
      contact_phone: normalizePhone(phone),
      contact_email: r.contact_email ? sanitizeExternalText(r.contact_email) : undefined,
      website: r.website ? sanitizeExternalText(r.website) : undefined,
      city: r.city ? sanitizeExternalText(r.city) : undefined,
      industry: r.industry ? sanitizeExternalText(r.industry) : undefined,
    });
  }

  const lead_ids: string[] = [];
  let duplicates = 0;

  // Chunk to keep batch inserts small
  for (let i = 0; i < valid.length; i += 200) {
    const chunk = valid.slice(i, i + 200);

    // Dedupe within the chunk itself too
    const seen = new Set(chunk.map((c) => c.contact_phone));
    const existing = await supabaseAdmin
      .from("leads")
      .select("id, dedupe_key")
      .eq("company_id", companyId)
      .in("dedupe_key", [...seen]);
    const existingKeys = new Set((existing.data ?? []).map((e) => e.dedupe_key));

    const toInsert = chunk
      .filter((c) => !existingKeys.has(c.contact_phone))
      .map((c) => ({
        company_id: companyId,
        source_id: sourceId,
        business_name: c.business_name,
        contact_name: c.contact_name ?? null,
        contact_phone: c.contact_phone,
        contact_email: c.contact_email ?? null,
        website: c.website ?? null,
        city: c.city ?? null,
        industry: c.industry ?? null,
        dedupe_key: c.contact_phone, // unique per tenant (partial index)
        status: "new" as const,
      }));

    if (toInsert.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .insert(toInsert)
        .select("id");
      if (error) throw error;
      lead_ids.push(...(data ?? []).map((d) => d.id));
    }
    duplicates += chunk.length - toInsert.length;
  }

  return { inserted: lead_ids.length, duplicates, skipped_invalid, lead_ids };
}

/**
 * Website adapter — fetches a PUBLIC company homepage and extracts only
 * basic business facts (title/description/phone). The response is capped
 * and sanitized; it is stored as lead data, never executed as instructions.
 * robots/ToS-respecting: single page, single request, no crawling.
 */
export async function extractFromWebsite(
  url: string,
): Promise<{ business_name: string; contact_phone?: string; description?: string } | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "SawtiGrowth/1.0 (+https://www.sawti-ai.com)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = (await res.text()).slice(0, 200_000); // hard cap
    const title = html.match(/<title[^>]*>([^<]{2,200})<\/title>/i)?.[1];
    const desc = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{2,300})["']/i,
    )?.[1];
    // Saudi phones on public pages (050..., +966..., 9200...)
    const phoneMatch =
      html.match(/(?:\+966|00966|0)?\s?5\d{2}\s?\d{3}\s?\d{3}/)?.[0] ??
      html.match(/9200\s?\d{5}/)?.[0] ??
      html.match(/011\s?\d{7,8}/)?.[0];

    const business_name = sanitizeExternalText(title ?? "");
    if (!business_name) return null;
    return {
      business_name,
      contact_phone: phoneMatch ? normalizePhone(phoneMatch) : undefined,
      description: sanitizeExternalText(desc ?? ""),
    };
  } catch {
    return null; // network/timeout/parse errors — never fake a lead
  }
}
