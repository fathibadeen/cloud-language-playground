import { describe, expect, it } from "vitest";
import { isEndingSoon, usageLevel } from "./notification-types";

describe("usageLevel", () => {
  it("alerts at 80%", () => expect(usageLevel(240, 300)).toBe(80));
  it("alerts at 100%", () => expect(usageLevel(300, 300)).toBe(100));
  it("no alert below 80%", () => expect(usageLevel(239, 300)).toBeNull());
});

describe("isEndingSoon", () => {
  const now = new Date("2026-10-25T00:00:00Z");
  it("fires within 3 days", () => expect(isEndingSoon("2026-10-27T00:00:00Z", now)).toBe(true));
  it("does not fire 4 days out", () => expect(isEndingSoon("2026-10-29T00:00:00Z", now)).toBe(false));
  it("does not fire after expiry", () => expect(isEndingSoon("2026-10-24T00:00:00Z", now)).toBe(false));
});
