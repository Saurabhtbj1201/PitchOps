/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeCreateIncident, executeUpdateIncidentStatus } from "../src/lib/incidents.logic";
import { executeTranslateBroadcast } from "../src/lib/broadcast.logic";
import { executeGenerateOpsBrief } from "../src/lib/ops.logic";

process.env.GEMINI_API_KEY = "test-key-for-vitest";

// Mock generateText from 'ai'
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

// Mock ai-gateway.server
vi.mock("../src/lib/ai-gateway.server", () => ({
  createGeminiProvider: vi.fn(() => vi.fn()),
  DEFAULT_CHAT_MODEL: "gemini-2.0-flash",
  requireGeminiKey: vi.fn(() => "test-key-for-vitest"),
}));

import { generateText } from "ai";

describe("Server Functions Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeCreateIncident", () => {
    it("classifies and inserts a new incident", async () => {
      // Mock Gemini AI classification response
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify({
          kind: "medical",
          severity: "high",
          priority_reason: "Fan requires medical attention.",
        }),
      } as any); // Cast return value if needed, or simply let vi.mocked handle it

      // Mock Supabase context
      const insertMock = vi.fn().mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { id: "inc-123", kind: "medical" },
              error: null,
            }),
        }),
      });

      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === "incidents") {
            return { insert: insertMock };
          }
        }),
      };

      const result = await executeCreateIncident(
        { venueId: "venue-1", sectionId: "sec-1", description: "Fan fainted." },
        { supabase: mockSupabase, userId: "user-123" },
      );

      expect(result).toEqual({ id: "inc-123", kind: "medical" });
      expect(generateText).toHaveBeenCalledOnce();
      expect(mockSupabase.from).toHaveBeenCalledWith("incidents");
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          venue_id: "venue-1",
          section_id: "sec-1",
          reporter_id: "user-123",
          description: "Fan fainted.",
          kind: "medical",
          severity: "high",
        }),
      );
    });
  });

  describe("executeUpdateIncidentStatus", () => {
    it("updates incident status", async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === "incidents") {
            return { update: updateMock };
          }
        }),
      };

      const result = await executeUpdateIncidentStatus(
        { id: "inc-123", status: "in_progress" },
        { supabase: mockSupabase },
      );

      expect(result).toEqual({ ok: true });
      expect(mockSupabase.from).toHaveBeenCalledWith("incidents");
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "in_progress" }));
      expect(eqMock).toHaveBeenCalledWith("id", "inc-123");
    });
  });

  describe("executeTranslateBroadcast", () => {
    it("translates text and inserts a broadcast record", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify({
          es: "Por favor diríjase al sector norte.",
          fr: "Merci de vous diriger vers le nord.",
        }),
      } as any);

      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === "broadcasts") {
            return { insert: insertMock };
          }
        }),
      };

      const result = await executeTranslateBroadcast(
        { text: "Please go north.", targets: ["es", "fr"], tone: "calm" },
        { supabase: mockSupabase, userId: "user-123" },
      );

      expect(result.translations.es).toBe("Por favor diríjase al sector norte.");
      expect(result.translations.fr).toBe("Merci de vous diriger vers le nord.");
      expect(generateText).toHaveBeenCalledOnce();
      expect(mockSupabase.from).toHaveBeenCalledWith("broadcasts");
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          author_id: "user-123",
          source_text: "Please go north.",
          tone: "calm",
        }),
      );
    });
  });

  describe("executeGenerateOpsBrief", () => {
    it("generates structured ops brief based on venue data", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify({
          summary: "Congestion at Gate A.",
          risks: ["Section 101 has high occupancy."],
          recommendations: [{ action: "Open Gate B", why: "High wait time", priority: "high" }],
        }),
      } as any);

      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { name: "MetLife Stadium", city: "East Rutherford", capacity: 80000 },
      });
      const eqMock1 = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });

      const eqMock2 = vi.fn().mockResolvedValue({
        data: [
          {
            occupancy_pct: 90,
            ingress_rate: 15,
            egress_rate: 5,
            gate_wait_s: 300,
            sections: { label: "101", tier: "Lower", nearest_gate: "Gate A", accessible: true },
          },
        ],
      });
      const selectMock2 = vi.fn().mockReturnValue({ eq: eqMock2 });

      const limitMock = vi.fn().mockResolvedValue({ data: [] });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const neqMock = vi.fn().mockReturnValue({ order: orderMock });
      const eqMock3 = vi.fn().mockReturnValue({ neq: neqMock });
      const selectMock3 = vi.fn().mockReturnValue({ eq: eqMock3 });

      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === "venues") {
            return { select: () => ({ eq: eqMock1 }) };
          }
          if (table === "venue_metrics") {
            return { select: selectMock2 };
          }
          if (table === "incidents") {
            return { select: selectMock3 };
          }
        }),
      };

      const result = await executeGenerateOpsBrief(
        { venueId: "venue-123" },
        { supabase: mockSupabase, userId: "user-123" },
      );

      expect(result.summary).toBe("Congestion at Gate A.");
      expect(result.risks).toContain("Section 101 has high occupancy.");
      expect(result.recommendations[0].action).toBe("Open Gate B");
      expect(generateText).toHaveBeenCalledOnce();
      expect(mockSupabase.from).toHaveBeenCalledWith("venues");
      expect(mockSupabase.from).toHaveBeenCalledWith("venue_metrics");
      expect(mockSupabase.from).toHaveBeenCalledWith("incidents");
    });
  });
});
