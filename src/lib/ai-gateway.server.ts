import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Creates a Google Generative AI provider instance using the GEMINI_API_KEY
 * environment variable. Uses the official @ai-sdk/google package to connect
 * directly to Google's Generative AI API — no third-party proxy required.
 *
 * Get your free API key at: https://aistudio.google.com/app/apikey
 * Then add to .env:  GEMINI_API_KEY="AIzaSy..."
 */
export function createGeminiProvider() {
  const key = requireGeminiKey();
  return createGoogleGenerativeAI({ apiKey: key });
}

/**
 * Default Gemini model for all chat, classification, and generation tasks.
 * gemini-2.0-flash is fast, cost-efficient, multimodal-capable, and free-tier friendly.
 */
export const DEFAULT_CHAT_MODEL = "gemini-2.0-flash";

/**
 * Reads and validates the GEMINI_API_KEY from the environment.
 * This key must be kept server-side only — never prefix with VITE_.
 *
 * @throws Error with a helpful message if the key is missing or still a placeholder
 */
export function requireGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your_gemini_api_key_here") {
    throw new Error(
      "GEMINI_API_KEY is not configured. " +
        "Get a free key at https://aistudio.google.com/app/apikey " +
        "then add GEMINI_API_KEY=\"AIzaSy...\" to your .env file.",
    );
  }
  return key;
}
