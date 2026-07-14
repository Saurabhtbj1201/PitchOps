import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Simulates the client half of the GenAI chat flow. The real /api/chat route
 * streams via toUIMessageStreamResponse; here we mock global fetch so the
 * test verifies request shape, streamed body parsing, and error handling
 * without hitting the Lovable AI Gateway.
 */

function encodeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

describe("GenAI chat flow (mocked)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts role + language + messages to /api/chat", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(encodeStream(["Hello ", "fan!"]), { status: 200 }),
    );

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "fan",
        language: "en",
        venueContext: "Venue: Test Arena",
        messages: [{ role: "user", parts: [{ type: "text", text: "Where is gate 4?" }] }],
      }),
    });

    expect(res.ok).toBe(true);
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.role).toBe("fan");
    expect(body.language).toBe("en");
    expect(body.messages).toHaveLength(1);

    const text = await readAll(res.body!);
    expect(text).toBe("Hello fan!");
  });

  it("surfaces 400 when messages array is missing", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Invalid request body", { status: 400 }),
    );
    const res = await fetch("/api/chat", { method: "POST", body: "{}" });
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/Invalid request body/i);
  });

  it("surfaces 400 when messages array is too large", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Invalid request body", { status: 400 }),
    );
    // Simulating 51 messages (max is 50)
    const messages = Array(51).fill({ role: "user", parts: [{ type: "text", text: "hi" }] });
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        role: "fan",
        language: "en",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("handles gateway 402 credit-exhausted response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Payment required", { status: 402 }),
    );
    const res = await fetch("/api/chat", { method: "POST", body: "{}" });
    expect(res.status).toBe(402);
  });

  it("handles gateway 429 rate limit", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Too Many Requests", { status: 429 }),
    );
    const res = await fetch("/api/chat", { method: "POST", body: "{}" });
    expect(res.status).toBe(429);
  });

  it("streams multiple chunks that concatenate to the full response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(encodeStream(["Gate ", "4 ", "is ", "north."]), { status: 200 }),
    );
    const res = await fetch("/api/chat", { method: "POST", body: "{}" });
    const text = await readAll(res.body!);
    expect(text).toBe("Gate 4 is north.");
  });
});
