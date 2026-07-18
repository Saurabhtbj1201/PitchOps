import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORTED_LANGUAGES, RTL_LANGUAGES } from "@/lib/languages";
import { StadiumMap } from "@/components/StadiumMap";
import { MetricPill } from "@/components/MetricPill";
import { MessageBubble } from "@/components/MessageBubble";
import { Send, Accessibility, Type, CalendarPlus, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fan")({
  head: () => ({
    meta: [
      { title: "Fan Companion — PitchOps" },
      {
        name: "description",
        content:
          "Multilingual matchday assistant: navigation, gate waits, accessibility, transport.",
      },
    ],
  }),
  component: FanPage,
});

import { Section, Metric } from "@/types";

function FanPage() {
  const [language, setLanguage] = useState("en");
  const [largeText, setLargeText] = useState(false);
  const [venueId, setVenueId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [amenity, setAmenity] = useState<string>("restroom");

  useEffect(() => {
    document.documentElement.setAttribute("data-large-text", String(largeText));
    document.documentElement.setAttribute("lang", language);
    document.documentElement.setAttribute("dir", RTL_LANGUAGES.has(language) ? "rtl" : "ltr");
  }, [largeText, language]);

  const { data: venues } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("venues").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!venueId && venues && venues.length) setVenueId(venues[0].id);
  }, [venues, venueId]);

  const { data: sections } = useQuery({
    queryKey: ["sections", venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .eq("venue_id", venueId)
        .order("label");
      if (error) throw error;
      return (data ?? []) as Section[];
    },
    enabled: !!venueId,
  });

  useEffect(() => {
    if (!sectionId && sections && sections.length) setSectionId(sections[0].id);
  }, [sections, sectionId]);

  const { data: metrics } = useQuery({
    queryKey: ["metrics", venueId],
    queryFn: async () => {
      const ids = (sections ?? []).map((s) => s.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("venue_metrics")
        .select("*")
        .in("section_id", ids);
      if (error) throw error;
      return (data ?? []) as Metric[];
    },
    enabled: !!(sections && sections.length),
    refetchInterval: 15000,
  });

  const venue = venues?.find((v) => v.id === venueId);
  const currentSection = sections?.find((s) => s.id === sectionId);
  const currentMetric = metrics?.find((m) => m.section_id === sectionId);

  const venueContext = useMemo(() => {
    if (!venue || !sections) return "";
    const lines = (sections ?? []).map((s) => {
      const m = metrics?.find((mm) => mm.section_id === s.id);
      return `Section ${s.label} (${s.tier}, gate ${s.nearest_gate}${s.accessible ? ", wheelchair accessible" : ""}): occupancy ${m?.occupancy_pct ?? "?"}%, wait ${m?.gate_wait_s ?? "?"}s.`;
    });
    return `VENUE CONTEXT: ${venue.name}, ${venue.city}. Fan seat: section ${currentSection?.label ?? "?"} (gate ${currentSection?.nearest_gate ?? "?"}). Live section metrics:\n${lines.join("\n")}`;
  }, [venue, sections, metrics, currentSection]);

  const transport = new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({ role: "fan", language, venueContext }),
  });

  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === "streaming" || status === "submitted") return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  };

  const quickAsks = [
    "Nearest restroom to my seat",
    "Which gate has the shortest wait?",
    "Wheelchair route from my seat to first aid",
    "Explain offside in one paragraph",
  ];

  const calendarLink = venue
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("World Cup 2026 match at " + venue.name)}&location=${encodeURIComponent(venue.name + ", " + venue.city)}`
    : "#";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section aria-labelledby="my-day" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 id="my-day" className="text-2xl font-bold tracking-tight">
            Your matchday
          </h1>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="lang">
              Language
            </label>
            <select
              id="lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setLargeText((v) => !v)}
              aria-pressed={largeText}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
              aria-label="Toggle large text"
            >
              <Type className="h-3.5 w-3.5" aria-hidden />
              Large text
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="venueSelect" className="mb-1 block text-sm font-medium">
                Venue
              </label>
              <select
                id="venueSelect"
                value={venueId}
                onChange={(e) => {
                  setVenueId(e.target.value);
                  setSectionId("");
                }}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {(venues ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sectionSelect" className="mb-1 block text-sm font-medium">
                Your section
              </label>
              <select
                id="sectionSelect"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {(sections ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} — {s.tier} · {s.nearest_gate}
                    {s.accessible ? " ♿" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <MetricPill
              label="Occupancy"
              value={currentMetric ? `${currentMetric.occupancy_pct}%` : "—"}
            />
            <MetricPill
              label="Gate wait"
              value={currentMetric ? `${currentMetric.gate_wait_s}s` : "—"}
            />
            <MetricPill label="Access" value={currentSection?.accessible ? "♿ Yes" : "No"} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <label htmlFor="amenitySelect" className="flex items-center gap-1 text-xs">
              <Accessibility className="h-3.5 w-3.5" aria-hidden /> Route to:
            </label>
            <select
              id="amenitySelect"
              value={amenity}
              onChange={(e) => setAmenity(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              aria-label="Amenity"
            >
              <option value="restroom">Nearest restroom</option>
              <option value="food">Nearest food/drink</option>
              <option value="first_aid">First aid</option>
              <option value="family">Family room</option>
              <option value="prayer">Prayer room</option>
              <option value="sensory">Sensory-quiet zone</option>
            </select>
            <button
              type="button"
              onClick={() =>
                sendMessage({
                  text: `I'm in section ${currentSection?.label}. Show me the wheelchair-friendly route to the nearest ${amenity.replace("_", " ")}, mentioning the gate and any concourse to use.`,
                })
              }
              className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
            >
              Get route
            </button>
          </div>

          <a
            href={calendarLink}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Add match to Google Calendar
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>

        {venue && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Stadium map</h2>
            <StadiumMap
              sections={sections ?? []}
              metrics={metrics ?? []}
              highlightedSectionId={sectionId}
            />
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Getting there</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Venue location map · Transit directions powered by Google Maps.
          </p>
          {venue && (
            <div className="mt-3 space-y-3">
              {/*
               * OpenStreetMap embed (Leaflet via OSM tile layer) — works with
               * zero API keys. Google Maps navigation is a separate deep link.
               * For production with a Maps Platform key, replace the src with:
               * https://www.google.com/maps/embed/v1/place?key=KEY&q=LAT,LNG
               */}
              <div
                className="overflow-hidden rounded-lg border border-border"
                style={{ height: 220 }}
              >
                <iframe
                  title={`Map of ${venue.name}`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${venue.longitude - 0.01},${venue.latitude - 0.008},${venue.longitude + 0.01},${venue.latitude + 0.008}&layer=mapnik&marker=${venue.latitude},${venue.longitude}`}
                  aria-label={`Map showing ${venue.name}, ${venue.city}`}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}&travelmode=transit`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  🚌 Google Maps — Transit <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}&travelmode=driving`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  🚗 Google Maps — Driving <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      <section
        aria-labelledby="chat"
        className="flex h-[calc(100vh-8rem)] flex-col rounded-xl border border-border bg-card"
      >
        <div className="border-b border-border p-4">
          <h2 id="chat" className="text-lg font-semibold">
            Ask the assistant
          </h2>
          <p className="text-xs text-muted-foreground">
            Multilingual. Grounded in the live venue data above.
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Try:</p>
              <div className="flex flex-wrap gap-2">
                {quickAsks.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage({ text: q })}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m: UIMessage) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {(status === "submitted" || status === "streaming") && (
            <div className="text-xs text-muted-foreground">Assistant is thinking…</div>
          )}
        </div>

        <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
          <label htmlFor="msg" className="sr-only">
            Your message
          </label>
          <input
            id="msg"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your seat, the queue, or how to get here…"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim() || status === "streaming" || status === "submitted"}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            aria-label="Send"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </section>
    </div>
  );
}
