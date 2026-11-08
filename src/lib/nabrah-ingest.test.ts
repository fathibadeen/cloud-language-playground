import { describe, expect, it } from "vitest";
import { pick } from "./nabrah-ingest.server";

describe("nabrah payload picking", () => {
  it("reads nested fields through a JSON-stringified call_details", () => {
    const payload = {
      call_details: JSON.stringify({
        transcript: [{ role: "user", content: "أريد حجز موعد غداً" }],
      }),
    };
    expect(pick(payload, ["call_details.transcript"])).toEqual([
      { role: "user", content: "أريد حجز موعد غداً" },
    ]);
  });

  it("reads nested fields when call_details is already an object", () => {
    const payload = { call_details: { transcript: "نص المكالمة" } };
    expect(pick(payload, ["call_details.transcript"])).toBe("نص المكالمة");
  });

  it("leaves non-JSON strings untouched", () => {
    expect(pick({ status: "completed" }, ["status"])).toBe("completed");
  });

  it("returns undefined for missing keys", () => {
    expect(pick({}, ["call_details.transcript"])).toBeUndefined();
  });
});
