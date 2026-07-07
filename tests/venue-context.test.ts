import { describe, it, expect } from "vitest";

/**
 * Tests for the venue context string builder logic.
 * The venueContext string is injected into every Gemini request as grounding data.
 * Correctness here directly affects AI response quality.
 */

type Section = {
  id: string;
  label: string;
  tier: string;
  nearest_gate: string;
  accessible: boolean;
};

type Metric = {
  section_id: string;
  occupancy_pct: number;
  gate_wait_s: number;
};

type Venue = {
  name: string;
  city: string;
};

/** Mirrors the venueContext builder in _authenticated.fan.tsx */
function buildVenueContext(
  venue: Venue,
  sections: Section[],
  metrics: Metric[],
  currentSection: Section | undefined,
): string {
  const lines = sections.map((s) => {
    const m = metrics.find((mm) => mm.section_id === s.id);
    return `Section ${s.label} (${s.tier}, gate ${s.nearest_gate}${s.accessible ? ", wheelchair accessible" : ""}): occupancy ${m?.occupancy_pct ?? "?"}%, wait ${m?.gate_wait_s ?? "?"}s.`;
  });
  return `VENUE CONTEXT: ${venue.name}, ${venue.city}. Fan seat: section ${currentSection?.label ?? "?"} (gate ${currentSection?.nearest_gate ?? "?"}). Live section metrics:\n${lines.join("\n")}`;
}

const MOCK_VENUE: Venue = { name: "MetLife Stadium", city: "East Rutherford" };

const MOCK_SECTIONS: Section[] = [
  { id: "s1", label: "101", tier: "Lower", nearest_gate: "Gate A", accessible: true },
  { id: "s2", label: "215", tier: "Mezzanine", nearest_gate: "Gate C", accessible: false },
];

const MOCK_METRICS: Metric[] = [
  { section_id: "s1", occupancy_pct: 72, gate_wait_s: 120 },
  { section_id: "s2", occupancy_pct: 55, gate_wait_s: 60 },
];

describe("venueContext builder", () => {
  it("includes venue name and city", () => {
    const ctx = buildVenueContext(MOCK_VENUE, MOCK_SECTIONS, MOCK_METRICS, MOCK_SECTIONS[0]);
    expect(ctx).toContain("MetLife Stadium");
    expect(ctx).toContain("East Rutherford");
  });

  it("includes the fan's current section and gate", () => {
    const ctx = buildVenueContext(MOCK_VENUE, MOCK_SECTIONS, MOCK_METRICS, MOCK_SECTIONS[0]);
    expect(ctx).toContain("section 101");
    expect(ctx).toContain("Gate A");
  });

  it("marks wheelchair-accessible sections", () => {
    const ctx = buildVenueContext(MOCK_VENUE, MOCK_SECTIONS, MOCK_METRICS, MOCK_SECTIONS[0]);
    expect(ctx).toContain("wheelchair accessible");
    // Non-accessible section should not have the marker
    expect(ctx).not.toMatch(/Section 215.*wheelchair/);
  });

  it("embeds live occupancy and wait time for each section", () => {
    const ctx = buildVenueContext(MOCK_VENUE, MOCK_SECTIONS, MOCK_METRICS, MOCK_SECTIONS[0]);
    expect(ctx).toContain("occupancy 72%");
    expect(ctx).toContain("wait 120s");
    expect(ctx).toContain("occupancy 55%");
    expect(ctx).toContain("wait 60s");
  });

  it("uses ? for missing metrics", () => {
    const ctx = buildVenueContext(MOCK_VENUE, MOCK_SECTIONS, [], MOCK_SECTIONS[0]);
    expect(ctx).toContain("occupancy ?%");
    expect(ctx).toContain("wait ?s");
  });

  it("uses ? for missing current section", () => {
    const ctx = buildVenueContext(MOCK_VENUE, MOCK_SECTIONS, MOCK_METRICS, undefined);
    expect(ctx).toContain("section ?");
  });

  it("handles empty sections list", () => {
    const ctx = buildVenueContext(MOCK_VENUE, [], [], MOCK_SECTIONS[0]);
    expect(ctx).toContain("VENUE CONTEXT");
    expect(ctx).toContain("MetLife Stadium");
  });
});
