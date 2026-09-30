/**
 * Reads a finished conversation (voice transcript or WhatsApp thread) and, when
 * the customer and the agent agreed on a time, stores a confirmed appointment.
 * Server-only: uses the service-role client after the caller was verified.
 */

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "openai/gpt-6-astra";

export type BookingSettings = {
  company_id: string;
  enabled: boolean;
  timezone: string;
  work_days: number[];
  start_time: string;
  end_time: string;
  slot_minutes: number;
  services: string[];
  calendar_token: string;
};

type Extracted = {
  has_booking: boolean;
  customer_name?: string | null;
  customer_phone?: string | null;
  service?: string | null;
  date_time?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
};

/** Returns the company booking settings, creating defaults on first use. */
export async function loadBookingSettings(companyId: string): Promise<BookingSettings | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("booking_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (data) return data as unknown as BookingSettings;
  const { data: created } = await supabaseAdmin
    .from("booking_settings")
    .insert({ company_id: companyId })
    .select("*")
    .maybeSingle();
  return (created as unknown as BookingSettings) ?? null;
}

function transcriptToText(transcript: unknown): string {
  if (!transcript) return "";
  if (typeof transcript === "string") return transcript;
  if (Array.isArray(transcript)) {
    return transcript
      .map((turn) => {
        if (typeof turn === "string") return turn;
        const t = turn as Record<string, unknown>;
        const role = String(t["role"] ?? t["speaker"] ?? t["from"] ?? "");
        const text = String(t["content"] ?? t["text"] ?? t["message"] ?? "");
        return text ? `${role}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

async function extract(
  text: string,
  settings: BookingSettings,
  nowIso: string,
): Promise<Extracted | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key || text.trim().length < 20) return null;

  const system = [
    "أنت محلل محادثات. اقرأ نص المحادثة بين عميل وموظف/وكيل ذكي وحدد إن تم الاتفاق على حجز موعد.",
    `الوقت الحالي بصيغة ISO: ${nowIso}. المنطقة الزمنية: ${settings.timezone}.`,
    settings.services.length ? `الخدمات المتاحة: ${settings.services.join("، ")}.` : "",
    `مدة الموعد الافتراضية: ${settings.slot_minutes} دقيقة.`,
    "أعد JSON فقط بالحقول:",
    '{"has_booking": boolean, "customer_name": string|null, "customer_phone": string|null, "service": string|null, "date_time": "ISO 8601 with offset"|null, "duration_minutes": number|null, "notes": string|null}',
    "إذا لم يتم تحديد موعد واضح ومتفق عليه بتاريخ ووقت، اجعل has_booking=false.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: text.slice(0, 12000) },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  try {
    const json = JSON.parse(raw.replace(/^```json\s*|```$/g, "")) as Extracted;
    return json;
  } catch {
    return null;
  }
}

type Context = {
  companyId: string;
  agentId?: string | null;
  callId?: string | null;
  conversationId?: string | null;
  customerId?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  source: "voice_call" | "whatsapp";
};

/**
 * Extracts a booking from the given conversation text and stores it as a
 * confirmed appointment. Returns the appointment id when one was created.
 */
export async function bookFromConversation(
  ctx: Context,
  transcript: unknown,
): Promise<{ created: boolean; appointmentId?: string; reason?: string }> {
  const text = transcriptToText(transcript);
  if (!text) return { created: false, reason: "no_transcript" };

  const settings = await loadBookingSettings(ctx.companyId);
  if (!settings || !settings.enabled) return { created: false, reason: "booking_disabled" };

  const parsed = await extract(text, settings, new Date().toISOString());
  if (!parsed?.has_booking || !parsed.date_time) return { created: false, reason: "no_booking" };

  const start = new Date(parsed.date_time);
  if (isNaN(start.getTime())) return { created: false, reason: "bad_date" };
  const minutes = Number(parsed.duration_minutes) > 0
    ? Number(parsed.duration_minutes)
    : settings.slot_minutes;
  const end = new Date(start.getTime() + minutes * 60000);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (ctx.callId) {
    const { data: dupe } = await supabaseAdmin
      .from("appointments").select("id").eq("call_id", ctx.callId).maybeSingle();
    if (dupe) return { created: false, reason: "already_booked", appointmentId: dupe.id };
  }
  if (ctx.conversationId) {
    // One live booking per WhatsApp thread, so re-reading the thread on every
    // new message cannot duplicate the same appointment.
    const { data: dupe } = await supabaseAdmin
      .from("appointments").select("id, start_time")
      .eq("conversation_id", ctx.conversationId)
      .eq("status", "confirmed")
      .gte("start_time", new Date(Date.now() - 3600000).toISOString())
      .maybeSingle();
    if (dupe) return { created: false, reason: "already_booked", appointmentId: dupe.id };
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      company_id: ctx.companyId,
      customer_id: ctx.customerId ?? null,
      agent_id: ctx.agentId ?? null,
      call_id: ctx.callId ?? null,
      conversation_id: ctx.conversationId ?? null,
      customer_name: parsed.customer_name ?? ctx.customerName ?? null,
      customer_phone: parsed.customer_phone ?? ctx.customerPhone ?? null,
      service_name: parsed.service ?? null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "confirmed",
      source: ctx.source,
      notes: parsed.notes ?? null,
    })
    .select("id")
    .single();
  if (error) return { created: false, reason: error.message };

  const when = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    timeZone: settings.timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(start);

  await supabaseAdmin.from("notifications").insert({
    company_id: ctx.companyId,
    title: "موعد جديد تم حجزه",
    body: `${parsed.customer_name ?? ctx.customerName ?? "عميل"} — ${parsed.service ?? "موعد"} — ${when}`,
    type: `appointment_${inserted.id}`,
  });

  return { created: true, appointmentId: inserted.id };
}

/** Builds an iCalendar feed so the company can subscribe from Google Calendar. */
export function buildIcs(
  rows: { id: string; start_time: string; end_time: string; customer_name: string | null; customer_phone: string | null; service_name: string | null; notes: string | null; status: string }[],
  companyName: string,
): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (v: string) => v.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sawti//Appointments//AR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(companyName)}`,
  ];
  for (const r of rows) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@sawti-ai.com`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(r.start_time)}`,
      `DTEND:${stamp(r.end_time)}`,
      `SUMMARY:${esc(`${r.service_name ?? "موعد"} — ${r.customer_name ?? "عميل"}`)}`,
      `DESCRIPTION:${esc([r.customer_phone, r.notes].filter(Boolean).join(" | "))}`,
      `STATUS:${r.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
