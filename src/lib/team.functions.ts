import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Creates a real team invitation. The row is written through the caller's
 * RLS-scoped client, so only owners/admins of that company can create one.
 */
export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["admin", "agent", "viewer"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: membership, error: mErr } = await context.supabase
      .from("company_members")
      .select("role")
      .eq("company_id", data.companyId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Forbidden");
    }

    const { data: invitation, error } = await context.supabase
      .from("company_invitations")
      .insert({
        company_id: data.companyId,
        email: data.email.toLowerCase(),
        role: data.role,
        invited_by: context.userId,
      })
      .select("id, token, email, role, expires_at")
      .single();
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId,
      user_id: context.userId,
      action: "team.invited",
      entity: "company_invitations",
      entity_id: invitation.id,
      metadata: { email: data.email, role: data.role },
    });

    return invitation;
  });

/**
 * Token-gated public lookup so the invite page can show who invited you
 * before you sign in. Returns no personal data beyond the invited email.
 */
export const peekInvitation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(10) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("company_invitations")
      .select("email, role, expires_at, accepted_at, companies(name)")
      .eq("token", data.token)
      .maybeSingle();

    if (!row) return { valid: false as const };
    const expired = new Date(row.expires_at) < new Date();
    if (expired || row.accepted_at) return { valid: false as const };

    return {
      valid: true as const,
      email: row.email,
      role: row.role,
      companyName: (row.companies as { name: string } | null)?.name ?? "",
    };
  });
