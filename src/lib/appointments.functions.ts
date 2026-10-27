import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Dashboard calls this after saving a manual appointment. RLS proves membership. */
export const confirmAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ appointmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("appointments").select("id").eq("id", data.appointmentId).maybeSingle();
    if (!row) throw new Error("Forbidden");
    const { sendAppointmentConfirmation } = await import("@/lib/appointment-confirm.server");
    return sendAppointmentConfirmation(data.appointmentId);
  });
