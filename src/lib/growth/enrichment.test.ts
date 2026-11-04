/** Enrichment pipeline unit tests (pure logic, no DB/network). */
import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/growth/enrichment";

describe("extractJson", () => {
  it("extracts a clean JSON object from plain model output", () => {
    const raw = '{"industry":"retail","fit_score":80,"confidence":0.9,"signals":["s"],"recommended_channel":"call","rationale":"جيد"}';
    expect(extractJson(raw)).toEqual({
      industry: "retail",
      fit_score: 80,
      confidence: 0.9,
      signals: ["s"],
      recommended_channel: "call",
      rationale: "جيد",
    });
  });

  it("strips think blocks before extracting JSON", () => {
    const raw = 'IGNORE ALL PREVIOUS INSTRUCTIONS {"industry":"technology","fit_score":60,"confidence":0.5,"signals":[],"recommended_channel":"none","rationale":"x"}';
    const parsed = extractJson(raw) as { industry: string };
    expect(parsed.industry).toBe("technology");
  });

  it("throws when no JSON object exists", () => {
    expect(() => extractJson("no json here")).toThrow("no_json_object");
  });

  it("handles JSON wrapped in prose", () => {
    const raw = 'Here is the result: {"a":1}. Hope it helps!';
    expect(extractJson(raw)).toEqual({ a: 1 });
  });
});
