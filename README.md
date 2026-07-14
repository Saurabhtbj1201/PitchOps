# PitchOps — Smart Stadiums & Tournament Operations (FIFA World Cup 2026)

> Google Prompt Wars · Challenge 04 — Smart Stadiums & Tournament Operations

A GenAI-powered, multi-role assistant that optimizes stadium operations and elevates the FIFA World Cup 2026 experience for fans, volunteers/staff, and ops control rooms. Powered by **Google Gemini** via the Lovable AI Gateway, backed by Lovable Cloud (Postgres + Auth), and designed for Google Maps Platform + Google Calendar integration.

# ⚽ PitchOps — Smart Stadiums & Tournament Operations (FIFA World Cup 2026)

<div align="center">

## 🚀 Google Prompt Wars • Challenge 04

A GenAI-powered platform to optimize stadium operations and enhance the FIFA World Cup 2026 experience through intelligent, real-time assistance.

<br>

<img src="assets/google-for-developers.png" height="60" alt="Google for Developers"/>
&nbsp;&nbsp;&nbsp;
<img src="assets/promptwars.png" height="60" alt="PromptWars"/>
&nbsp;&nbsp;&nbsp;
<img src="assets/hack2skill.png" height="60" alt="Hack2Skill"/>

<br><br>

[![Google for Developers](https://img.shields.io/badge/Google_For_Developers-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/)
[![PromptWars](https://img.shields.io/badge/PromptWars-Challenge_04-blueviolet?style=for-the-badge)](https://promptwars.in/)
[![Hack2Skill](https://img.shields.io/badge/Hack2Skill-Hackathon-orange?style=for-the-badge)](https://hack2skill.com/)
[![Google Gemini](https://img.shields.io/badge/Powered_by-Google_Gemini-4285F4?style=for-the-badge)](https://ai.google.dev/)

</div>

---

# 🌍 About The Project

PitchOps is a **Generative AI-powered Smart Stadium Operations Platform** built for **Google Prompt Wars Challenge 04**.

The platform assists:

- 👥 Fans
- 🦺 Volunteers
- 🏟 Stadium Staff
- 🚓 Security Teams
- 📊 Operations Control Rooms

by providing intelligent, multilingual, real-time assistance using Google Gemini AI.

The goal is to improve:

- Smart Stadium Navigation
- Crowd Management
- Emergency Response
- Accessibility
- Transportation Guidance
- Sustainability
- Volunteer Assistance
- Operations Intelligence
- Real-time Decision Support

for the **FIFA World Cup 2026**.

---

# 🏆 PromptWars Virtual Participation

<div align="center">

### Build • Deploy • Win From Anywhere

</div>

This repository is actively being developed as part of **PromptWars: Virtual India**.

| Event             | Details                            |
| ----------------- | ---------------------------------- |
| Organizer         | Google for Developers × Hack2Skill |
| Event             | PromptWars Virtual                 |
| Region            | 🇮🇳 India Only                      |
| Format            | Bi-weekly Virtual Hackathon        |
| Development Style | Prompt-first Engineering           |
| AI Platform       | Google Gemini                      |
| Workflow          | Google Antigravity                 |

**Official Event**

https://promptwars.in/promptwarsVirtual.html

---

# 📅 How The 14-Day Cycle Works

| Phase                | Timeline       | Description                                                                       |
| -------------------- | -------------- | --------------------------------------------------------------------------------- |
| 🚀 Challenge Release | Day 1 (Monday) | A new real-world AI challenge is released.                                        |
| 💻 Building Phase    | Day 1 – Day 12 | Build a production-ready solution using Google Gemini and prompt-first workflows. |
| 📤 Submission Phase  | By Day 13      | Submit source code, live demo, blog and LinkedIn Build-in-Public post.            |
| 🏅 Evaluation        | Day 14         | Experts review projects and update the leaderboard.                               |

---

**Live URL:** https://pitch-ops.vercel.app/

---

## 1. Approach & Logic

The problem statement asks for one solution that improves navigation, crowd management, accessibility, transport, sustainability, multilingual assistance, and real-time decision support during matchday. Rather than building three siloed apps, PitchOps ships **one app with three role-scoped experiences**:

| Role                  | What they get                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fan**               | Multilingual matchday companion — chat in 7 languages, live gate/section metrics, wheelchair-accessible amenity routing, transit link to the venue, Google Calendar match-add.                                    |
| **Volunteer / Staff** | Incident reporter with automatic Gemini classification (kind + severity), SOP lookup, live Kanban triage board (new → dispatched → in-progress → resolved).                                                       |
| **Ops Control**       | Live crowd heatmap, streaming Gemini **Ops Brief** with prioritized recommendations grounded in current metrics + open incidents, multilingual PA broadcast composer with tone control, sustainability KPI panel. |

### Why "one app, three roles"?

- **Data flows across roles.** A fan-facing amenity route reuses the same section metrics an ops team acts on. A staff-reported incident feeds the same Gemini brief ops reads. Splitting the app would duplicate logic and hide these dependencies.
- **Realistic tournament UX.** A single volunteer might act as staff during ingress and consume the fan view during a match — one auth session, one role switcher.
- **Judge-ready in one screen.** Every rubric track is demonstrable from the same login.

### GenAI logic

- **Model:** `google/gemini-3-flash-preview` for everything (chat, classification, structured ops brief, multilingual translation). Fast, cheap, and multimodal-capable if we later add photo attachments to incidents.
- **Streaming chat** uses the Vercel AI SDK (`streamText` + `toUIMessageStreamResponse`) so responses feel live and support `message.parts` rendering.
- **Grounding.** Fan chat receives a compact `VENUE CONTEXT` block on every request (venue name, seat, live per-section occupancy + gate waits). Ops brief pulls venue + metrics + incidents at generation time. The system prompt forbids invented numbers.
- **Role-scoped system prompts.** Fan = warm & simple. Staff = procedural & terse. Ops = analytical & metric-citing.
- **Structured output** (Ops brief, incident classification, broadcast translation) uses prompt-driven JSON parsing with a safe fallback — deliberately avoiding heavy schema constraints that some models reject.

---

## 2. How the solution works

### End-to-end matchday flow

```
                      ┌────────────────────────────┐
                      │  Landing / Auth (/, /auth) │
                      └──────────────┬─────────────┘
                                     │  Email + Google OAuth
                                     ▼
              ┌──────────────────────────────────────────┐
              │  /_authenticated  (role-gated shell)     │
              │  role switcher + sign-out                │
              └──┬──────────────┬─────────────────┬──────┘
                 │              │                 │
                 ▼              ▼                 ▼
             /fan           /staff              /ops
        fan companion   incident console   command center
                 │              │                 │
                 └──────┬───────┴────────┬────────┘
                        ▼                ▼
              /api/chat (stream)   server functions
          Gemini streaming chat   ops.functions.ts
                                  incidents.functions.ts
                                  broadcast.functions.ts
                        └────────┬────────┘
                                 ▼
                    Lovable AI Gateway → google/gemini-3-flash-preview
                                 +
                    Lovable Cloud (Postgres + Auth + RLS + Realtime)
                                 +
                    /api/public/tick (matchday simulator)
```

### Data model

Every table has RLS + explicit GRANTs. Roles live in a separate `user_roles` table with a `has_role(user_id, role)` `SECURITY DEFINER` helper — never on the profile.

| Table                                                     | Purpose                                                                                 |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `profiles`                                                | Display name, preferred language, accessibility prefs.                                  |
| `user_roles` (+ `app_role` enum: `fan`/`volunteer`/`ops`) | Role assignments. Auto-`fan` on sign-up via trigger.                                    |
| `venues`, `sections`                                      | Seeded with MetLife Stadium & Estadio Azteca + sections.                                |
| `venue_metrics`                                           | Per-section live telemetry (occupancy, ingress/egress, gate wait). Realtime-enabled.    |
| `incidents`                                               | Staff reports. AI classification stored as JSONB. Realtime-enabled.                     |
| `sops`                                                    | Seeded SOPs (medical, crowd, lost child, accessibility, weather, security).             |
| `broadcasts`                                              | Multilingual PA announcements composed by ops.                                          |
| `chat_threads`                                            | Reserved for persisted conversations (not required for the current session-based demo). |

### Real-time updates

`venue_metrics` and `incidents` are added to `supabase_realtime`. Both Fan and Ops pages subscribe to their venue channel and re-run TanStack Query fetchers when changes arrive.

### Matchday simulator

`POST /api/public/tick` jitters every section's metrics ±5% and adjusts gate-wait ±30s. The Ops "Simulate matchday tick" button drives it live for demos.

---

## 3. Google Services used

| Service                                                                    | Where                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Gemini** (`google/gemini-3-flash-preview`) via Lovable AI Gateway | All chat, classification, ops brief, translation.                                                                                                                                                                                                                       |
| **Google OAuth** (managed by Lovable Cloud)                                | Sign in with Google on `/auth`.                                                                                                                                                                                                                                         |
| **Google Maps** (deep link)                                                | Fan "Open transit directions" link with lat/lng of venue. Google Maps Platform connector can be plugged in for embedded maps and Places API (New) without code changes; the app is designed to consume `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` when connected. |
| **Google Calendar** (link template)                                        | Fan "Add match to Google Calendar" — no OAuth required, uses public `calendar.google.com/render?action=TEMPLATE` URL.                                                                                                                                                   |

---

## 4. Rubric mapping (Problem Statement Alignment)

| Focus area                      | Where in the app                                                                                                                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code Quality**                | Strict TS, TanStack Start server-fn boundaries, Zod validation, `useSuspenseQuery` / TanStack Query, split component files (`StadiumMap`), typed AI SDK usage.                                                                                           |
| **Security**                    | Roles in separate table + `has_role()` security-definer, RLS on every table, `LOVABLE_API_KEY` server-only, Zod validation, HMAC-eligible cron route, `requireSupabaseAuth` middleware on every write server function, no `dangerouslySetInnerHTML`.     |
| **Efficiency**                  | Gemini Flash (cheap + fast), Supabase Realtime instead of polling, TanStack Query cache, SVG map (no heavy 3D), lazy per-role routes, single provider per request.                                                                                       |
| **Testing**                     | Manual E2E is documented in Demo Script below; run `bun run build` and `bun run lint` in CI. Playwright hooks in place.                                                                                                                                  |
| **Accessibility**               | WCAG 2.2 AA color contrast, keyboard focus rings, skip-to-content link, ARIA live regions on chat + Ops brief, semantic landmarks, alt/`<title>`/`<desc>` on the SVG map, RTL support for Arabic, large-text toggle, `prefers-reduced-motion` respected. |
| **Google Services**             | Gemini (chat/classification/brief/translate), Google OAuth, Google Maps deep link, Google Calendar link template.                                                                                                                                        |
| **Problem Statement Alignment** | Every rubric track is covered — see the table in this README under "Rubric mapping".                                                                                                                                                                     |

---

## 5. Demo script (5 minutes)

1. **`/`** — Landing page pitches the three roles.
2. **`/auth`** — Create an account (email or Google). You are now signed in as a **Fan**.
3. **`/fan`** — Pick venue + section. Change language to Spanish. Click "Nearest restroom → Get route" — the assistant replies in Spanish with a section-aware route. Toggle Large text.
4. Elevate yourself: in the Cloud dashboard (Users), add `volunteer` and `ops` roles for your user via SQL:
   ```sql
   INSERT INTO public.user_roles(user_id, role) VALUES ('YOUR_UUID', 'volunteer'), ('YOUR_UUID', 'ops');
   ```
5. **`/staff`** — Log an incident: _"Fan fainted in section 112, near aisle 4."_ Gemini classifies it as medical/high in ~1s. Move it across the board.
6. **`/ops`** — Click **Simulate matchday tick** twice. Watch the heatmap change. Click **Generate** on the AI Ops Brief — Gemini returns summary + risks + prioritized recommendations grounded in the metrics. Compose a broadcast in English, target ES/FR/PT, tone `urgent`, click Translate.

---

## 6. Assumptions

- Telemetry is **simulated** via `/api/public/tick` — production would connect to real IoT/CV feeds.
- `fan` role is auto-granted on sign-up; `volunteer` and `ops` are granted by an admin (via SQL / the Cloud dashboard) — no self-serve role escalation, by design.
- Google Maps Platform connector is optional — the app links out to Google Maps rather than embedding, so the demo works without paid API keys.
- No FIFA/tournament trademarks are used; visual language references the tournament thematically only.

---

## 7. Running locally

The project is a TanStack Start v1 app.

```bash
bun install
bun run dev       # starts Vite dev server on :8080
bun run build     # production build
bun run lint      # eslint
```

Environment (auto-managed by Lovable Cloud):

- `LOVABLE_API_KEY` — for Gemini via Lovable AI Gateway (server-only)
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — database + auth
- Frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## 8. Tech stack

- **Framework:** TanStack Start v1 (React 19 + Vite 7)
- **Styling:** Tailwind CSS v4 + shadcn/ui + oklch design tokens
- **State:** TanStack Query + Supabase Realtime
- **AI:** Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`) → Lovable AI Gateway → `google/gemini-3-flash-preview`
- **Backend:** Lovable Cloud (Postgres + Auth + RLS + Realtime), server functions via `createServerFn`, public webhook route via TanStack server routes
- **Validation:** Zod
- **Markdown rendering:** `react-markdown`

---

## License

Prototype built for Google Prompt Wars Challenge 04. FIFA and tournament marks are property of their respective owners and are not used in this project.

---

# 👨‍💻 Developer

<div align="center">

### © Made with ❤️ by Saurabh Kumar. All Rights Reserved 2025

<a href="https://github.com/Saurabhtbj1201">
  <img src="https://github.com/Saurabhtbj1201.png" width="120" style="border-radius:50%;" alt="Saurabh Kumar"/>
</a>

## [Saurabh Kumar](https://github.com/Saurabhtbj1201)

<a href="https://github.com/Saurabhtbj1201">
<img src="https://img.shields.io/github/followers/Saurabhtbj1201?label=Follow&style=social"/>
</a>

### 🔗 Connect With Me

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/saurabhtbj1201)

[![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/saurabhtbj1201)

[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://instagram.com/saurabhtbj1201)

[![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://facebook.com/saurabh.tbj)

[![Portfolio](https://img.shields.io/badge/Portfolio-FF5722?style=for-the-badge&logo=googlechrome&logoColor=white)](https://gu-saurabh.site)

[![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/9798024301)

---

⭐ If you found this project useful, consider giving it a Star!

Built with ❤️ using Google Gemini, React, TanStack Start and Lovable Cloud.

</div>
