/**
 * Sawti Growth — Approval Center (Phase 3)
 *
 * Human approval is a HARD gate: no call/message job can exist unless its
 * approval item was individually approved by an owner/admin. Approval is a
 * prerequisite, NEVER a substitute: the compliance engine still re-checks
 * every lead at dial time (suppression, consent, window, limits, kill switch).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/* ---------------- Create an approval batch ---------------- */

export const createApprovalBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        campaignId: z.string().uuid(),
        channel: z.enum(["call", "whatsapp"]),
        title: z.string().min(1).max(200),
        leadIds: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Campaign must belong to the caller's company (RLS proves membership,
    // but we fail fast with a clear error)
    const { data: campaign } = await context.supabase
      .from("campaigns")
      .select("id, company_id, status")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (!campaign) throw new Error("Forbidden: campaign not in your company");
    if (campaign.status !== "draft" && campaign.status !== "pending_approval") {
      throw new Error("invalid_campaign_status_for_batch");
    }

    // Every lead must belong to the same company
    for (const leadId of data.leadIds) {
      const { data: lead } = await context.supabase
        .from("leads")
        .select("id")
        .eq("id", leadId)
        .maybeSingle();
      if (!lead) throw new Error("Forbidden: lead not in your company");
    }

    const { data: batch, error } = await supabaseAdmin
      .from("approval_batches")
      .insert({
        company_id: campaign.company_id,
        campaign_id: campaign.id,
        channel: data.channel,
        title: data.title,
        item_count: data.leadIds.length,
        status: "pending",
        created_by: context.user.id,
      })
      .select("id")
      .single();
    if (error || !batch) throw new Error("batch_create_failed");

    const items = data.leadIds.map((leadId) => ({
      company_id: campaign.company_id,
      batch_id: batch.id,
      lead_id: leadId,
      decision: "pending",
    }));
    const { error: itemsErr } = await supabaseAdmin.from("approval_items").insert(items);
    if (itemsErr) throw new Error("items_create_failed");

    // Move the campaign into the approval pipeline
    await supabaseAdmin
      .from("campaigns")
      .update({ status: "pending_approval" })
      .eq("id", campaign.id);

    await supabaseAdmin.from("audit_logs").insert({
      action: "growth_approval_batch_created",
      entity: "approval_batch",
      entity_id: batch.id,
      company_id: campaign.company_id,
      metadata: { leadCount: data.leadIds.length, channel: data.channel } as never,
    });

    return { ok: true as const, batchId: batch.id, itemCount: data.leadIds.length };
  });

/* ---------------- Decide on one item ---------------- */

export const decideApprovalItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        itemId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: item } = await context.supabase
      .from("approval_items")
      .select("id, batch_id, company_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item) throw new Error("Forbidden: item not in your company");

    const { error } = await supabaseAdmin
      .from("approval_items")
      .update({
        decision: data.decision,
        decided_by: context.user.id,
        decided_at: new Date().toISOString(),
        note: data.note ?? null,
      })
      .eq("id", data.itemId);
    if (error) throw error;

    await supabaseAdmin.from("audit_logs").insert({
      action: `growth_approval_item_${data.decision}`,
      entity: "approval_item",
      entity_id: data.itemId,
      company_id: item.company_id,
      metadata: { by: context.user.id, note: data.note ?? null } as never,
    });

    return { ok: true as const };
  });

/* ---------------- Batch decision (individual items still recorded) ---------------- */

export const decideApprovalBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        batchId: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "cancelled"]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: batch } = await context.supabase
      .from("approval_batches")
      .select("id, company_id, campaign_id, status")
      .eq("id", data.batchId)
      .maybeSingle();
    if (!batch) throw new Error("Forbidden: batch not in your company");
    if (batch.status !== "pending") throw new Error("batch_already_decided");

    const update =
      data.decision === "approved"
        ? { decision: "approved", decided_by: context.user.id, decided_at: new Date().toISOString() }
        : { decision: "rejected", decided_by: context.user.id, decided_at: new Date().toISOString() };

    // Batch approve applies to pending items only (already-decided stay as-is)
    const { error: itemsErr } = await supabaseAdmin
      .from("approval_items")
      .update(update)
      .eq("batch_id", batch.id)
      .eq("decision", "pending");
    if (itemsErr) throw itemsErr;

    await supabaseAdmin
      .from("approval_batches")
      .update({
        status: data.decision,
        reviewed_by: context.user.id,
        reviewed_at: new Date().toISOString(),
        decision_note: data.note ?? null,
      })
      .eq("id", batch.id);

    if (batch.campaign_id && data.decision === "approved") {
      await supabaseAdmin
        .from("campaigns")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: context.user.id,
        })
        .eq("id", batch.campaign_id);
    }

    await supabaseAdmin.from("audit_logs").insert({
      action: `growth_approval_batch_${data.decision}`,
      entity: "approval_batch",
      entity_id: batch.id,
      company_id: batch.company_id,
      metadata: { by: context.user.id, note: data.note ?? null } as never,
    });

    return { ok: true as const };
  });
