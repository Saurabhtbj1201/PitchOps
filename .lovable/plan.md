# Smart Stadiums & Tournament Operations — FIFA World Cup 2026

A GenAI-powered, multi-role assistant that optimizes stadium operations and elevates the tournament experience. Three personas share one app with a role switcher: **Fan**, **Volunteer/Staff**, and **Ops Control**. Powered by Google's Gemini (via Lovable AI Gateway) + Google Maps Platform, with simulated live venue telemetry and staff-reported incidents.

---

## 1. Product Scope (Broad MVP across all tracks)

### Fan role — matchday companion

- **Multilingual chat assistant** (English, Spanish, French, Portuguese, Arabic, Hindi, Japanese) — Gemini natively translates; language selector in header.
- **Smart indoor navigation**: pick your section/seat → get walking directions to nearest gate, restroom, halal/veg food, first aid, family room, prayer room. Rendered as a stylized stadium SVG map with highlighted route.
- **Live gate & concession wait times** (simulated stream) — assistant recommends the least-congested gate near your seat.
- **Accessibility mode**: wheelchair-friendly routing, sensory-quiet zones, audio-described narration toggle, large-text mode, high-contrast theme.
- **Transportation**: Google Maps Directions API to the stadium from user's location, with public transit + park-and-ride options + real-time ETA.
- **Match context**: schedule, group standings, "explain offside in my language" style Q&A.

### Volunteer / Staff role — field ops

- **Incident reporter**: quick form (type, section, severity, notes, photo) → writes to Cloud DB, assistant classifies & routes.
- **SOP lookup**: "Someone fainted in section 112" → Gemini retrieves the right SOP snippet + escalation contact.
- **Task feed**: assigned tasks with priority, one-tap acknowledge/resolve.
- **Multilingual fan-facing phrasebook**: staff types EN, gets voice-ready translation for the fan's language.

### Ops Control role — command center dashboard

- **Live crowd heatmap** across sections (occupancy, ingress rate, egress rate).
- **AI Decision Support panel**: Gemini streams recommendations grounded in current telemetry + incidents ("Gate C is at 92% — open overflow lane at Gate D; redirect fans via concourse ring").
- **Incident triage board** (Kanban: new → dispatched → in-progress → resolved).
- **Sustainability KPIs**: energy, water, waste-diversion, transit-mode split — assistant summarizes trends.
- **Broadcast composer**: draft multilingual PA/SMS announcements with tone controls (calm/urgent/celebratory), one-click translate & preview.

---

## 2. Architecture

```text
 ┌────────────── Browser (TanStack Start, React 19) ──────────────┐
 │  Role switcher · Fan UI · Staff UI · Ops Dashboard             │
 │  Stadium SVG map · Chat (AI Elements) · Charts (Recharts)      │
 └───────────────▲───────────────────────────▲────────────────────┘
                 │ useChat / server fns      │
 ┌───────────────┴───────────────────────────┴───────────────────┐
 │  TanStack Server Routes & Server Functions                    │
 │   /api/chat            streaming Gemini assistant             │
 │   /api/ops-brief       structured ops recommendations         │
 │   /api/translate       multilingual broadcast composer        │
 │   /api/tick (cron)     simulate live telemetry updates        │
 │   incidents.functions  create / list / update incidents       │
 │   maps.functions       geocode / directions via GMP gateway   │
 └───────────────▲───────────────────────────▲────────────────────┘
                 │                           │
    ┌────────────┴────────┐       ┌──────────┴─────────────┐
    │ Lovable AI Gateway  │       │ Google Maps Platform    │
    │ google/gemini-3-    │       │ Directions · Places(New)│
    │ flash-preview       │       │ Air Quality · Weather   │
    └─────────────────────┘       └─────────────────────────┘
                 │
    ┌────────────┴────────┐
    │  Lovable Cloud       │
    │  (Supabase)          │
    │  auth · RLS · tables │
    │  + pg_cron simulator │
    └──────────────────────┘
```

---

## 3. Data Model (Lovable Cloud / Supabase)

All tables in `public` with GRANTs + RLS + `has_role()` pattern.

- `profiles(user_id, display_name, language, accessibility_prefs jsonb)`
- `app_role` enum: `fan | volunteer | ops`
- `user_roles(user_id, role)` + `has_role()` security-definer fn
- `venues(id, name, city, geo)`
- `sections(id, venue_id, label, capacity, accessibility_flags)`
- `venue_metrics(id, section_id, occupancy_pct, ingress_rate, egress_rate, gate_wait_s, updated_at)` — updated by cron
- `incidents(id, venue_id, section_id, kind, severity, status, reporter_id, assignee_id, description, ai_classification jsonb, created_at)`
- `sops(id, kind, language, body)` — small seeded knowledge base
- `broadcasts(id, author_id, source_text, translations jsonb, tone, created_at)`
- `chat_threads(id, user_id, role_context)` + `chat_messages(id, thread_id, role, content jsonb, created_at)`

RLS:

- Fans read only public venue data + their own threads/incidents they reported.
- Volunteers read/write incidents assigned to them + venue metrics read-only.
- Ops (`has_role('ops')`) reads/writes everything at their venue.

---

## 4. GenAI Design (Gemini via Lovable AI Gateway)

- **Default model**: `google/gemini-3-flash-preview` for all chat, translation, classification, and decision support (fast, multimodal, cheap).
- **Provider helper**: `src/lib/ai-gateway.server.ts` using `@ai-sdk/openai-compatible` per the Lovable Gateway pattern (never expose `LOVABLE_API_KEY` to the client).
- **Streaming chat**: `src/routes/api/chat.ts` using `streamText` + `toUIMessageStreamResponse`, `stepCountIs(50)`.
- **Tools** the assistant can call:
  - `getVenueStatus(venueId)` → occupancy, gate waits, weather, air quality.
  - `findNearestAmenity(sectionId, kind)` → routing on stadium graph.
  - `lookupSop(query)` → returns SOP snippet (RAG-lite from seeded `sops` table).
  - `createIncident(...)` → **`needsApproval: true`** for staff/ops writes.
  - `translateBroadcast(text, targets, tone)` → returns multi-language JSON.
- **Structured output** (Ops brief): small constraint-free schema for `{ summary, risks[], recommendations[] }`, with `NoObjectGeneratedError` fallback per gateway rules.
- **System prompts** are role-scoped: fan prompt is warm/simple; staff prompt is procedural/terse; ops prompt is analytical and cites metrics.
- **Grounding**: every tool result is included in-context so answers cite the current numbers, not hallucinations.

---

## 5. Google Services Integration

1. **Gemini via Lovable AI Gateway** — chat, translation, classification, structured ops recommendations.
2. **Google Maps Platform** (via `google_maps` connector, gateway-only):
   - **Routes API** — directions to stadium, transit ETAs.
   - **Places API (New)** — nearby parking/hotels/transit.
   - **Air Quality API** — outdoor air quality shown to fans + ops.
   - **Weather API** — matchday weather for kickoff decisions.
   - **Maps JS API** in browser via `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` for the transport map.
3. **Google Translate** — optional layer for guaranteed deterministic translation of PA broadcasts (Gemini handles the fluent conversational multilingual chat). We'll use Gemini by default and note Translate as a swap-in for regulated PA text if the user wants it later.
4. **Google Calendar** (light touch) — "Add match to my calendar" button generates a Google Calendar template link (no OAuth required).

---

## 6. UX / Design System

- **Dark, high-contrast operations aesthetic** with a WC2026-inspired warm accent (deep teal `#0B3D3B` + gold `#F5B301` + off-white).
- Typography: Inter (system-fast), with `@fontsource/inter` if needed.
- Component kit: shadcn/ui already in project (dialog, tabs, sheet, toast, command palette).
- Chat UI via AI Elements pattern: `message.parts` rendering, streaming indicator, markdown, tool-call chips.
- Stadium map: inline SVG (bowl + sections + amenities), route highlight via CSS classes.
- Role switcher = top-right segmented control; role is persisted in profile + URL (`/fan`, `/staff`, `/ops`).

Routes:

- `/` — landing + language + role picker
- `/auth` — email/password + Google sign-in
- `/_authenticated/fan` — fan companion
- `/_authenticated/staff` — staff console
- `/_authenticated/ops` — ops dashboard
- `/api/chat`, `/api/ops-brief`, `/api/translate`, `/api/public/tick` (cron simulator)

---

## 7. Accessibility (first-class, not bolted on)

- WCAG 2.2 AA color contrast on both themes; verified with tokens in `styles.css`.
- Full keyboard navigation; visible focus rings; `Skip to content` link.
- Semantic landmarks (`main`, `nav`, `aside`), one `<h1>` per route, proper heading order.
- ARIA live regions for chat streaming + incident status updates.
- Reduced-motion media query respected on all animations.
- Alt text on every image + SVG `<title>`/`<desc>` on the stadium map.
- Screen-reader-only helper class for icon-only buttons.
- Language attribute switches with the UI language.
- Large-text and dyslexia-friendly toggle in fan settings.

---

## 8. Security

- Roles in a separate `user_roles` table with `has_role()` security-definer function — never on `profiles`.
- RLS on every table + GRANTs to `authenticated`/`service_role`; `anon` only where a policy explicitly allows.
- All AI + Maps calls are server-side; `LOVABLE_API_KEY` and connector keys never reach the browser.
- Zod validation on every server function input and API route body.
- HMAC-signed cron endpoint at `/api/public/tick` (secret via `generate_secret`).
- `dangerouslySetInnerHTML` banned; markdown rendered with `react-markdown`.
- Rate-limiting note in README (no built-in primitive — mention as tradeoff).
- Leaked-password protection (HIBP) enabled at auth.

---

## 9. Efficiency

- **TanStack Query** loaders + `useSuspenseQuery` (no `useEffect`+`fetch`).
- Gemini Flash model = low latency + cheap; `service_tier: priority` is skipped (Flash-preview is not priority-eligible).
- Cron simulator writes small deltas, not full snapshots.
- Realtime updates via Supabase Realtime on `venue_metrics` and `incidents` (subscribe only to the active venue).
- Tool calls stream through `toUIMessageStreamResponse` with `stepCountIs(50)`.
- SVG map + CSS routes instead of a heavy 3D engine.
- Client bundle: no duplicate Vite plugins; assets lazy-loaded per role route.

---

## 10. Testing

- **Vitest** unit tests for: role guards, SOP retrieval, incident classification prompt shape, translation JSON shape, Zod validators.
- **Component tests** with Testing Library for: role switcher, incident form validation, accessibility toggles.
- **Server-function tests** with a mocked Lovable Gateway fetch returning canned Gemini responses.
- **Playwright smoke** (via shell) after build: sign in as fan → chat → get route; sign in as ops → see dashboard → generate brief.
- CI script: `bun test` + `tsgo` typecheck referenced in README.

---

## 11. Problem Statement Alignment (mapped to rubric)

| Rubric track               | How we hit it                                                                    |
| -------------------------- | -------------------------------------------------------------------------------- |
| Smart indoor navigation    | Stadium SVG map + `findNearestAmenity` tool + accessibility routing              |
| Dynamic crowd management   | Live `venue_metrics` + ops heatmap + AI "open overflow gate" recommendations     |
| Real-time decision support | `/api/ops-brief` structured Gemini recommendations grounded in current telemetry |
| Multi-language assistance  | 7-language Gemini chat + broadcast composer with tone control                    |
| Accessibility              | Wheelchair routing, sensory-quiet zones, WCAG 2.2 AA, screen-reader-ready        |
| Transportation             | Google Maps Routes + transit ETAs + park-and-ride                                |
| Sustainability             | Ops KPI panel with AI trend summary                                              |
| Operational intelligence   | Incident triage board + SOP RAG + streaming assistant                            |

---

## 12. Deliverables (for the challenge submission)

- Public GitHub repo (via Lovable's GitHub integration).
- `README.md` with: approach, architecture diagram, screenshots, GenAI logic, assumptions, run instructions, and rubric mapping.
- Seed migration with two demo venues, seeded SOPs, and a small volunteer/ops demo account.
- One-click "Simulate matchday" button in ops dashboard that spins telemetry for the demo.

---

## 13. Build Order

1. Enable Lovable Cloud → auth (email + Google) + `user_roles` + RLS + seed migration.
2. Design system tokens in `styles.css` + role-switch shell layout + `__root.tsx` metadata.
3. Fan route: chat via `/api/chat` (Gemini) + stadium SVG + language selector.
4. Connect Google Maps Platform connector; transport panel with Routes + Places.
5. Staff route: incident form + task feed + SOP lookup tool.
6. Ops route: heatmap + realtime metrics + `/api/ops-brief` structured recommendations + broadcast composer.
7. Cron simulator at `/api/public/tick` with HMAC.
8. Accessibility pass (contrast, keyboard, ARIA, reduced motion, large-text toggle).
9. Vitest + Playwright smoke + README + screenshots.
10. Publish.

---

## Assumptions

- Demo runs with **simulated** live venue telemetry (no real stadium feed exists to hackathon devs).
- The developer's Google Maps Platform connector is used for both server calls (gateway) and browser Maps JS.
- Users sign up via Lovable Cloud auth; role is assigned by an ops admin (seed script grants demo accounts).
- We treat FIFA branding as reference-only; no official marks are used.

If you approve this, I'll implement in the order above starting with Cloud + auth + role scaffolding.
