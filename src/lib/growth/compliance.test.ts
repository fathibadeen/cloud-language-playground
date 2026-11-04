/**
 * Compliance engine tests (Vitest — same pattern as existing *.test.ts files).
 * These are pure-logic unit tests: no DB, no network, deterministic.
 */
import { describe, it, expect } from "vitest";
import { normalizePhone, isWithinTimeWindow } from "@/lib/growth/compliance";

describe("normalizePhone", () => {
  it("converts local Saudi format 05XXXXXXXX to +9665XXXXXXXX", () => {
    expect(normalizePhone("0501234567")).toBe("+966501234567");
  });
  it("converts 00 international prefix to +", () => {
    expect(normalizePhone("00966501234567")).toBe("+966501234567");
  });
  it("keeps already-normalized +966 numbers unchanged", () => {
    expect(normalizePhone("+966 50 123 4567")).toBe("+966501234567");
  });
  it("prefixes 966 numbers with +", () => {
    expect(normalizePhone("966501234567")).toBe("+966501234567");
  });
  it("treats a bare 9-digit 5xx number as Saudi mobile", () => {
    expect(normalizePhone("501234567")).toBe("+966501234567");
  });
});

describe("isWithinTimeWindow", () => {
  const settings = { timezone: "Asia/Riyadh", work_days: [0, 1, 2, 3, 4] };

  // All instants below are 10:30 Riyadh local time (07:30 UTC) on a Thursday (day 4)
  const thursday1030 = new Date("2026-11-05T07:30:00Z");
  const friday1030 = new Date("2026-11-06T07:30:00Z"); // Friday — not a work day

  it("allows calls inside the Sunday-Thursday 09:00-18:00 window", () => {
    expect(isWithinTimeWindow(settings, "call", thursday1030)).toBe(true);
  });

  it("blocks calls on Friday (outside Saudi business week)", () => {
    expect(isWithinTimeWindow(settings, "call", friday1030)).toBe(false);
  });

  it("blocks calls before 09:00 Riyadh time", () => {
    // 06:00 Riyadh = 03:00 UTC on a work day
    const early = new Date("2026-11-03T03:00:00Z");
    expect(isWithinTimeWindow(settings, "call", early)).toBe(false);
  });

  it("blocks calls after 18:00 Riyadh time", () => {
    // 19:00 Riyadh = 16:00 UTC on a work day
    const late = new Date("2026-11-03T16:00:00Z");
    expect(isWithinTimeWindow(settings, "call", late)).toBe(false);
  });
});

/**
 * Integration invariants (documented here, enforced by the engine):
 *
 * 1. evaluateOutreach returns allowed=false when ANY of these hold:
 *    - global kill switch row is missing (fail-closed default)
 *    - tenant campaigns are paused (default true)
 *    - the number is on the global OR tenant suppression list
 *    - no active (not withdrawn) consent record exists for that channel
 *    - the current Riyadh time is outside the channel window/work days
 *    - the tenant daily limit for that channel is already reached
 *    - legal review / caller ID / AI identification are unconfirmed
 *
 * 2. A batch approval is NOT part of the per-call verdict — approval gates
 *    the scheduler, and the engine still re-checks every lead at dial time.
 *    => "campaign approved" can never override consent or suppression.
 */
