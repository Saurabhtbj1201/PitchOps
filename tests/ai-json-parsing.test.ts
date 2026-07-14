import { describe, it, expect } from "vitest";

/**
 * Tests for the AI JSON parsing fallback logic used in:
 *  - incidents.functions.ts  (incident classification)
 *  - ops.functions.ts        (ops brief)
 *  - broadcast.functions.ts  (broadcast translations)
 *
 * Gemini may return JSON wrapped in code fences or with extra whitespace.
 * The app strips these and falls back gracefully if parsing fails.
 */

/** Mirrors the JSON cleaning logic in all three server functions */
function cleanAndParseJson<T>(raw: string, fallback: T): T {
  // Strip both ```json and plain ``` code fences (Gemini may use either)
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

const INCIDENT_FALLBACK = {
  kind: "other",
  severity: "medium",
  priority_reason: "Auto-classified fallback.",
};

describe("AI JSON parsing fallback (incident classification)", () => {
  it("parses clean JSON", () => {
    const raw = '{"kind":"medical","severity":"high","priority_reason":"Fan fainted."}';
    const result = cleanAndParseJson(raw, INCIDENT_FALLBACK);
    expect(result.kind).toBe("medical");
    expect(result.severity).toBe("high");
  });

  it("strips markdown code fences before parsing", () => {
    const raw =
      '```json\n{"kind":"security","severity":"critical","priority_reason":"Suspicious item."}\n```';
    const result = cleanAndParseJson(raw, INCIDENT_FALLBACK);
    expect(result.kind).toBe("security");
    expect(result.severity).toBe("critical");
  });

  it("strips code fences without language tag", () => {
    const raw =
      '```\n{"kind":"crowd","severity":"medium","priority_reason":"Gate congestion."}\n```';
    const result = cleanAndParseJson(raw, INCIDENT_FALLBACK);
    expect(result.kind).toBe("crowd");
  });

  it("handles extra whitespace and newlines around valid JSON", () => {
    const raw = `\n\n  {"kind":"lost_child","severity":"high","priority_reason":"Child separated."}\n  `;
    const result = cleanAndParseJson(raw, INCIDENT_FALLBACK);
    expect(result.kind).toBe("lost_child");
  });

  it("returns fallback for completely invalid JSON", () => {
    const raw = "I could not classify this incident.";
    const result = cleanAndParseJson(raw, INCIDENT_FALLBACK);
    expect(result.kind).toBe("other");
    expect(result.severity).toBe("medium");
    expect(result.priority_reason).toBe("Auto-classified fallback.");
  });

  it("returns fallback for empty string", () => {
    const result = cleanAndParseJson("", INCIDENT_FALLBACK);
    expect(result).toEqual(INCIDENT_FALLBACK);
  });

  it("returns fallback for truncated JSON", () => {
    const raw = '{"kind":"medical","severity":';
    const result = cleanAndParseJson(raw, INCIDENT_FALLBACK);
    expect(result).toEqual(INCIDENT_FALLBACK);
  });
});

describe("AI JSON parsing fallback (ops brief)", () => {
  const BRIEF_FALLBACK = {
    summary: "",
    risks: [] as string[],
    recommendations: [] as { action: string; why: string; priority: string }[],
  };

  it("parses a valid ops brief JSON", () => {
    const raw = JSON.stringify({
      summary: "Stadium at 78% capacity, gate B congested.",
      risks: ["Section 112 at 95% occupancy."],
      recommendations: [{ action: "Open lane 3", why: "Gate B wait is 280s", priority: "high" }],
    });
    const result = cleanAndParseJson(raw, BRIEF_FALLBACK);
    expect(result.summary).toContain("78%");
    expect(result.risks).toHaveLength(1);
    expect(result.recommendations[0].priority).toBe("high");
  });

  it("returns fallback structure for invalid ops brief", () => {
    const result = cleanAndParseJson("not json at all", BRIEF_FALLBACK);
    expect(result.risks).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });
});

describe("AI JSON parsing fallback (broadcast translation)", () => {
  const TRANSLATION_FALLBACK = { en: "Fallback message" };

  it("parses a multilingual translation map", () => {
    const raw = JSON.stringify({
      es: "Por favor dirígete al sector norte.",
      fr: "Merci de vous diriger vers le nord.",
    });
    const result = cleanAndParseJson(raw, TRANSLATION_FALLBACK);
    expect(result.es).toContain("norte");
    expect(result.fr).toContain("nord");
  });

  it("returns fallback for non-parseable translation", () => {
    const result = cleanAndParseJson("Translation not available.", TRANSLATION_FALLBACK);
    expect(result).toEqual(TRANSLATION_FALLBACK);
  });
});
