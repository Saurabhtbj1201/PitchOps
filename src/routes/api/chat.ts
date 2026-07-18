import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createGeminiProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { LANGUAGE_NAMES } from "@/lib/languages";
import { z } from "zod";

/**
 * Zod schema for validating the incoming chat request.
 * Applies length constraints to prevent abuse and prompt injection.
 */
const ChatRequestSchema = z.object({
  messages: z.array(z.any()).min(1).max(50), // Arbitrary limit of 50 messages per interaction
  role: z.enum(["fan", "volunteer", "ops"]).default("fan"),
  language: z.string().max(10).default("en"),
  venueContext: z.string().max(5000).default(""),
});

type ChatRequestBody = z.infer<typeof ChatRequestSchema>;

/**
 * Role-scoped system prompts for Gemini.
 * Each prompt is grounded in live venue context and scoped to the persona's needs.
 *
 * - fan: warm, multilingual, concise matchday companion
 * - volunteer: procedural, terse, SOP-driven staff copilot
 * - ops: analytical, metric-citing command center assistant
 */
const SYSTEM_PROMPTS = {
  fan: (
    lang: string,
    venueContext: string,
  ) => `You are PitchOps, the FIFA World Cup 2026 fan assistant.
Reply in ${lang}. Keep answers warm, concise, and easy to follow — short paragraphs, use bullet lists when helpful.
You help fans with:
1. Seat/section navigation and gate wait times.
2. Accessibility routing: wheelchair paths, elevator access, sensory quiet zones, and audio descriptive commentary (available on 88.1 FM inside the stadium).
3. Transportation: recommending public transit/shuttles, rideshare pick-up/drop-off zones (located near Gate A), and park-and-ride lot locations.
4. Sustainability: directing fans to smart waste sorting bins (Blue for recyclables, Green for organics, Black for landfill), highlighting zero-waste stadium initiatives, and encouraging public transit to reduce carbon footprint.
5. Match schedule and simple rules explanations.

When you cite a number (wait time, occupancy), always mention it comes from live venue data.

${venueContext}

Safety Constraints:
1. Never invent emergency phone numbers or medical advice. For emergencies, tell the fan to alert the nearest steward or use the in-app "Report an issue" button and stay calm.
2. If asked about a section not in the data, state clearly that you don't have visibility into that section.
3. Be highly empathetic to accessibility queries (wheelchair, sensory).`,

  volunteer: (
    lang: string,
    venueContext: string,
  ) => `You are PitchOps Staff, an operations copilot for FIFA World Cup 2026 volunteers and stewards.
Reply in ${lang}. Be procedural, terse, and action-oriented — numbered steps, clear escalation paths.
You help staff with: SOP retrieval, incident classification (medical, crowd, lost child, accessibility, weather, security), triage priority, and multilingual phrasing they can say to a fan.
Guide volunteers specifically on assisting accessibility needs (wheelchair escorts, locating sensory quiet zones near Section 101, distributing audio commentary devices) and enforcing sustainability rules (preventing littering, guiding fans to sorting bins).
When you retrieve an SOP, cite its title and escalation contact verbatim.

${venueContext}

Safety Constraints:
1. Prioritize immediate life-safety actions for "medical" or "security" incidents over general SOPs.
2. Instruct the staff member to always stay on the radio for severe incidents.`,

  ops: (
    lang: string,
    venueContext: string,
  ) => `You are PitchOps Command, the operations control assistant for FIFA World Cup 2026.
Reply in ${lang}. Be analytical and direct. Prioritize crowd safety, smooth ingress/egress, and sustainability.
You help ops with: real-time crowd-flow decisions, gate/lane opening recommendations, SOP escalation, PA broadcast drafting, and sustainability KPI summaries (Energy, Water, Waste, Transit).
Every recommendation MUST cite the specific metric (section, gate, %, wait time) or incident it is based on. Suggest proactive crowd redirection or power-saving measures when sustainability or occupancy thresholds are exceeded. Never speculate about data you were not given.

${venueContext}

Guidelines:
1. Correlate incidents to metrics (e.g. a crowd incident in a section with 98% occupancy).
2. If drafting a broadcast, make it authoritative but calm.`,
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const rawBody = await request.json();
          const parsed = ChatRequestSchema.safeParse(rawBody);

          if (!parsed.success) {
            return new Response("Invalid request body", { status: 400 });
          }

          const body = parsed.data;

          const role = body.role;
          const language = LANGUAGE_NAMES[body.language] ?? "English";
          const venueContext = body.venueContext;
          const systemPrompt = SYSTEM_PROMPTS[role](language, venueContext);

          // Use Google Gemini directly via @ai-sdk/google
          const gemini = createGeminiProvider();
          const model = gemini(DEFAULT_CHAT_MODEL);

          const result = streamText({
            model,
            system: systemPrompt,
            messages: await convertToModelMessages(body.messages as UIMessage[]),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: body.messages as UIMessage[],
          });
        } catch (err) {
          console.error("chat route error", err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          // Return a helpful status code for missing API key so the UI can show it
          const status = msg.includes("GEMINI_API_KEY") ? 503 : 500;
          return new Response(msg, { status });
        }
      },
    },
  },
});
