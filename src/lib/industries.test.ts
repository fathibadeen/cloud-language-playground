import { describe, expect, it } from "vitest";
import { isClinicIndustry } from "./industries";

describe("isClinicIndustry", () => {
  it("shows clinic menu for clinic activity", () => {
    expect(isClinicIndustry("clinic")).toBe(true);
    expect(isClinicIndustry("عيادة أسنان")).toBe(true);
  });
  it("hides clinic menu for other activities", () => {
    expect(isClinicIndustry("restaurant")).toBe(false);
    expect(isClinicIndustry(null)).toBe(false);
  });
});
