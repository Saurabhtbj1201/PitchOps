import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createGeminiProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { LANGUAGE_NAMES } from "@/lib/languages";

/**
 * Request body schema for POST /api/chat.
 * All fields except messages are optional and fall back to safe defaults.
 */
type ChatRequestBody = {
  messages?: unknown;
  role?: "fan" | "volunteer" | "ops";
  language?: string;
  venueContext?: string;
};

/**
 * Role-scoped system prompts for Gemini.
 * Each prompt is grounded in live venue context and scoped to the persona's needs.
 *
 * - fan: warm, multilingual, concise matchday companion
 * - volunteer: procedural, terse, SOP-driven staff copilot
 * - ops: analytical, metric-citing command center assistant
 */
const SYSTEM_PROMPTS = {
  fan: (lang: string, venueContext: string) => `You are PitchOps, the FIFA World Cup 2026 fan assistant.
Reply in ${lang}. Keep answers warm, concise, and easy to follow — short paragraphs, use bullet lists when helpful.
You help fans with: seat/section navigation, gate wait times, food and restroom locations, accessibility routing (wheelchair, sensory-quiet), transport to/from the venue, match schedule, and simple rules explanations.
When you cite a number (wait time, occupancy), always mention it comes from live venue data.
${venueContext}

Safety: never invent emergency phone numbers. For medical or security issues, tell the fan to alert the nearest steward or use the in-app "Report an issue" button and stay calm.`,

  volunteer: (lang: string, venueContext: string) => `You are PitchOps Staff, an operations copilot for FIFA World Cup 2026 volunteers and stewards.
Reply in ${lang}. Be procedural, terse, and action-oriented — numbered steps, clear escalation paths.
You help staff with: SOP retrieval, incident classification (medical, crowd, lost child, accessibility, weather, security), triage priority, and multilingual phrasing they can say to a fan.
When you retrieve an SOP, cite its title and escalation contact verbatim.
${venueContext}`,

  ops: (lang: string, venueContext: string) => `You are PitchOps Command, the operations control assistant for FIFA World Cup 2026.
Reply in ${lang}. Be analytical and direct. Prioritize crowd safety and flow.
You help ops with: real-time crowd-flow decisions, gate/lane opening recommendations, SOP escalation, PA broadcast drafting, and sustainability KPI summaries.
Every recommendation MUST cite the specific metric (section, gate, %, wait time) it is based on. Never speculate about data you were not given.
${venueContext}`,
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as ChatRequestBody;

          // Validate required field
          if (!Array.isArray(body.messages)) {
            return new Response("Messages are required", { status: 400 });
          }

          const role = body.role ?? "fan";
          const language = LANGUAGE_NAMES[body.language ?? "en"] ?? "English";
          const venueContext = body.venueContext ?? "";
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
