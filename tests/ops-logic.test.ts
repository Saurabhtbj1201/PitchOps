import { describe, it, expect } from "vitest";

/**
 * Tests for the matchday tick endpoint behaviour.
 * The tick route POST /api/public/tick jitters section metrics ±5%
 * and ±30s gate wait. Tests verify the jitter bounds stay realistic.
 */

/** Mirrors the jitter function from src/routes/api/public/tick.ts */
function jitter(value: number, maxDelta: number, min: number, max: number): number {
  const delta = Math.floor(Math.random() * (maxDelta * 2 + 1)) - maxDelta;
  return Math.min(max, Math.max(min, value + delta));
}

describe("matchday tick — jitter function", () => {
  const RUNS = 500;

  it("keeps occupancy within [0, 100]", () => {
    for (let i = 0; i < RUNS; i++) {
      const result = jitter(50, 5, 0, 100);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    }
  });

  it("keeps gate_wait_s above 0", () => {
    for (let i = 0; i < RUNS; i++) {
      const result = jitter(90, 30, 0, 600);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(600);
    }
  });

  it("clamps at min when starting value is very low", () => {
    for (let i = 0; i < RUNS; i++) {
      const result = jitter(0, 5, 0, 100);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });

  it("clamps at max when starting value is at ceiling", () => {
    for (let i = 0; i < RUNS; i++) {
      const result = jitter(100, 5, 0, 100);
      expect(result).toBeLessThanOrEqual(100);
    }
  });

  it("returns an integer", () => {
    for (let i = 0; i < 50; i++) {
      const result = jitter(60, 5, 0, 100);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});

describe("sustainability KPI derivation", () => {
  /**
   * Mirrors the KPI formulas in _authenticated.ops.tsx.
   * These are deterministic from avgOccupancy and should stay stable.
   */
  function computeKpis(avgOccupancy: number) {
    return {
      energyKwh: 12400 + avgOccupancy * 45,
      waterM3: 380 + Math.round(avgOccupancy * 1.8),
      wasteDiversionPct: Math.max(45, 80 - Math.round(avgOccupancy / 5)),
      transitPct: 62,
    };
  }

  it("energy scales with occupancy", () => {
    expect(computeKpis(0).energyKwh).toBe(12400);
    expect(computeKpis(100).energyKwh).toBe(16900);
    expect(computeKpis(50).energyKwh).toBe(14650);
  });

  it("waste diversion floor is 45%", () => {
    // At 100% occupancy: 80 - 20 = 60, still above floor
    expect(computeKpis(100).wasteDiversionPct).toBeGreaterThanOrEqual(45);
    // At very high occupancy it hits the floor
    expect(computeKpis(200).wasteDiversionPct).toBe(45);
  });

  it("transit share is constant at 62%", () => {
    expect(computeKpis(0).transitPct).toBe(62);
    expect(computeKpis(100).transitPct).toBe(62);
  });

  it("water scales with occupancy", () => {
    expect(computeKpis(0).waterM3).toBe(380);
    expect(computeKpis(100).waterM3).toBe(560);
  });
});
