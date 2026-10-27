import { describe, expect, it } from "vitest";
import { computeClinicStats, dueReminder, isEmergency } from "./clinic";

const now = new Date("2026-10-25T10:00:00Z");
const at = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

describe("clinic reminders", () => {
  it("sends the 24h reminder between 2 and 24 hours before", () => {
    expect(dueReminder({ start_time: at(20), status: "confirmed" }, now)).toBe("24h");
  });
  it("sends the 2h reminder within two hours", () => {
    expect(dueReminder({ start_time: at(1.5), status: "confirmed", reminder_24h_at: at(-20) }, now)).toBe("2h");
  });
  it("does not resend a reminder already sent", () => {
    expect(dueReminder({ start_time: at(20), status: "confirmed", reminder_24h_at: at(-1) }, now)).toBeNull();
  });
  it("follows up after a completed visit", () => {
    expect(dueReminder({ start_time: at(-24), status: "completed" }, now)).toBe("followup");
  });
  it("offers an alternative to no-shows", () => {
    expect(dueReminder({ start_time: at(-3), status: "no_show" }, now)).toBe("noshow");
  });
  it("never reminds cancelled appointments", () => {
    expect(dueReminder({ start_time: at(20), status: "cancelled" }, now)).toBeNull();
  });
});

describe("clinic safety", () => {
  it("detects emergencies", () => {
    expect(isEmergency("عندي ألم في الصدر وضيق تنفس")).toBe(true);
    expect(isEmergency("ابي احجز تنظيف اسنان")).toBe(false);
  });
});

describe("clinic stats", () => {
  it("show rate = attended / (attended + no-show)", () => {
    const s = computeClinicStats([
      { status: "completed", source: "voice_call", service_name: "تنظيف", start_time: at(-5) },
      { status: "completed", source: "manual", service_name: "تنظيف", start_time: at(-5) },
      { status: "completed", source: "whatsapp", service_name: "حشو", start_time: at(-5) },
      { status: "no_show", source: "whatsapp", service_name: "حشو", start_time: at(-5) },
      { status: "confirmed", source: "manual", service_name: null, start_time: at(5) },
    ]);
    expect(s.showRate).toBe(75);
    expect(s.byAgent).toBe(3);
    expect(s.topServices[0]).toEqual({ name: "تنظيف", count: 2 });
  });
});

import { needsInstantConfirmation } from "./clinic";
describe("instant confirmation", () => {
  it("is sent for voice and manual bookings with a phone", () => {
    expect(needsInstantConfirmation("voice_call", "+966500000000")).toBe(true);
    expect(needsInstantConfirmation("manual", "0500000000")).toBe(true);
  });
  it("is skipped for WhatsApp bookings and missing phones", () => {
    expect(needsInstantConfirmation("whatsapp", "+966500000000")).toBe(false);
    expect(needsInstantConfirmation("manual", null)).toBe(false);
  });
});
