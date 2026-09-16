# ClearCart

A chat-style product research assistant. A user types a product name into a
chat box; the app finds/assesses that product and gives it a
multi-dimensional rating (planet impact, people & supply chain, quality,
value, transparency) with sourced explanations — similar to how a capstone
research paper's rubric would score a product.

The original design is a Figma-style mockup with two frames: an empty chat
state ("Let's look at a product together") and a populated state showing a
user message, a "Found it!" reply card, and a rubric/conclusion writeup. The
sidebar (right-hand side) is persistent across the whole site: logo, nav
links to other pages, and a running list of past chat sessions ("Previous
Carts").

This is a git repository (`main` branch, tracking a GitHub remote). See
`BACKLOG.md` for the team's current sprint plan, ownership, and product
philosophy (no composite score, four coverage states instead of stars,
"Unknown" as an informative result) — that doc is owned by the team/Alex and
describes a broader scope (multi-person team, evidence pipeline, extension)
than what's on disk here; treat this file as the record of what's actually
implemented in this repo, not the roadmap.

## Tech stack

- React 19 + Vite (plain Vite/React template, not Next.js)
- React Router v7 for client-side routing
- Tailwind CSS v4, wired in via `@tailwindcss/vite` (no `tailwind.config.js`
  needed — v4 style)
- `oxlint` for linting (`npm run lint`)
- **Backend: two parallel targets, same logic duplicated between them**
  (see "Product lookup" below):
  - `server/` — Express, used for local dev (`npm run dev:api`).
  - `api/` — Azure Functions app, deployed alongside the frontend on Azure
    Static Web Apps ("managed Functions"). Separate `package.json`/deploy
    unit from the root project.
- Model access via **Microsoft Azure AI Foundry** (`@azure/ai-projects`,
  `@azure/identity`) — a hosted "prompt agent" (system prompt + model
  deployment, versioned), not a direct OpenAI/Anthropic API call. See below.
- No test framework set up (`npm test` runs nothing).

Run locally: `npm install && npm run dev` (runs Express on :8787 and Vite on
:5173 concurrently, via `concurrently`; Vite proxies `/api/*` to Express in
dev). See "Product lookup" for what does/doesn't need Azure credentials.

Node/npm were not preinstalled in the dev sandbox this was built in — if
that's true in a fresh environment too, install via `apt-get install -y
nodejs npm` (needs sudo/interactive auth, so the user usually runs it
themselves) before `npm install` will work. `package.json` pins
`engines.node` to `>=22.12.0 <23`.

## File map

```
src/
  App.jsx                  — routes (all under a shared Layout)
  components/
    Layout.jsx              — flex shell: main content (Outlet) + Sidebar
    Sidebar.jsx              — persistent right sidebar: logo, nav, history list
    ChatInput.jsx            — the pill-shaped message input + send button
    AssessmentCard.jsx       — the rubric result card (dimensions, coverage badges,
                               expandable sources, conclusion). Wired in and used.
    ProductConfirmCard.jsx   — a "Found it! Yes/No" confirm card. DEAD CODE — not
                               imported anywhere; leftover from the reverted
                               Brave/JSON-LD approach described below.
  hooks/
    useCarts.js               — subscribes a component to the carts localStorage store
  lib/
    carts.js                  — localStorage-backed chat history ("carts") CRUD
  pages/
    Home.jsx                  — the chat page (empty state + running conversation +
                                 POSTs to /api/chat)
    About.jsx, CapstonePaper.jsx, TechnicalOverview.jsx — placeholder content pages

server/                    — Express app for local dev (`node server/index.js`)
  index.js                  — /api/chat, /api/products/search (orphaned, see below)
  lib/
    foundryAgent.js          — calls the deployed Foundry agent
    responseCache.js         — hand-seeded cache checked before ever calling Foundry
    braveSearch.js, productLookup.js — orphaned, see "Product lookup" below

api/                        — Azure Functions app (separate deploy unit, own
                               package.json), mirrors server/'s /api/chat logic
  src/
    functions/chat.js, health.js
    lib/foundryAgent.js, responseCache.js  — near-duplicates of server/lib/*
                                              (slightly different Azure credential
                                              logic per environment — see below)

scripts/createAgent.js      — provisions/updates the Foundry agent (run manually,
                               not part of any request path)
```

Routes: `/` (Home/chat), `/about`, `/capstone-paper`, `/technical-overview`.
All render inside `Layout`, so the sidebar never unmounts between pages.

## Design system

Redesigned away from the original mockup's dark-navy palette toward
something **bright, high-contrast, and easy to read for older users** — this
was an explicit ask, not just a style preference:

- Primary color: **teal-600** (sidebar background, active nav pill, primary
  buttons, confirm-card borders/badges).
- Base font size bumped site-wide from 16px → 18px via `html { font-size:
  112.5% }` in `src/index.css`, rather than overriding every Tailwind text
  utility individually.
- High-contrast text everywhere: dark gray-900 text on white/light
  backgrounds instead of white-on-dark, larger touch targets (chat input,
  buttons, nav links all have generous padding).
- The active sidebar nav link renders as a solid white pill (not just a bold
  font-weight change) — bold-only state changes are hard to perceive, a
  solid state change isn't.

## Chat / history behavior (implemented)

- `Home.jsx` keeps a running conversation (`messages` state) — multiple
  product questions in one sitting stack in the same chat thread, not
  separate threads.
- **One sidebar history entry per chat session, not per message.** The first
  message of a session creates a "cart" (`lib/carts.js: addCart`); every
  subsequent message in that same session updates that same cart in place
  (`updateCart`) and bumps it to the top of the list, instead of creating a
  new sidebar item each time. This was a deliberate fix — the first pass
  created one cart per message, which was wrong.
- Carts persist to `localStorage` (`clearcart_carts`, capped at the 30 most
  recent), no account/backend needed. `useCarts.js` uses a custom
  `window` event (`clearcart:carts-updated`) plus the native `storage` event
  so the Sidebar re-renders live when Home writes a new cart, including
  across tabs.
- Clicking a past cart in the sidebar (`<Link to="/" state={{cartId}}>`)
  reopens that saved conversation. `Home` is remounted on every navigation
  to `/` via a `key={location.key}` wrapper in `App.jsx` (see `HomeRoute`),
  so the reopened cart's messages initialize cleanly via a lazy `useState`
  initializer rather than a `setState`-in-`useEffect` pattern (oxlint flags
  the latter as an anti-pattern — deriving state directly on remount is the
  cleaner fix).

## Product lookup — implemented, via a Foundry prompt agent (no retrieval)

`Home.jsx: handleSend` POSTs the conversation to `/api/chat`
(`server/index.js` in dev, `api/src/functions/chat.js` in prod — same logic,
duplicated). The response is `{ reply, assessment }`; when `assessment` is
present, `AssessmentCard` renders it (five dimensions × {score, coverage,
explanation, sources}, plus a conclusion). See "Response cache & demo mode"
below for the layer in front of this.

**How the agent itself works:**
- `scripts/createAgent.js` (`npm run agent:create`, run manually/occasionally,
  never per-request) provisions a versioned Azure AI Foundry "prompt agent" —
  a stored system prompt + model deployment (`FOUNDRY_MODEL_DEPLOYMENT`, e.g.
  `gpt-5-mini`). That's where the actual instructions live at runtime; the
  script is just the source text used to push them there.
- `foundryAgent.js: invokeFoundryAgent` calls that agent by name
  (`FOUNDRY_AGENT_NAME`) via the OpenAI-compatible Responses API
  (`openAI.responses.create`), re-appending a shorter JSON-shape
  reinforcement to the last user message each request. It retries once with
  a stricter format correction if the reply doesn't parse as the expected
  JSON, and defensively drops any source without a valid `http(s)` URL.
- **No retrieval, no tools, no database.** The agent is `kind: 'prompt'` —
  one LLM call against training-data knowledge, not live web search. It's
  instructed to self-report `coverage: unknown`/`claimed` rather than
  fabricate a `scored` result, but nothing verifies that claim — there's no
  fetch-and-check step. This matches BACKLOG.md's A3 item ("Evidence
  orchestration: Tavily search → typed findings → deterministic gating"),
  which is explicitly *not yet built* — adding real evidence-gathering would
  mean either a Foundry built-in tool (e.g. Bing grounding) or a custom
  function-calling tool your own backend executes and feeds results back
  through, turning `invokeFoundryAgent` from one call into a request/tool-result
  loop. Neither exists today.
- Credentials: `DefaultAzureCredential` (dev, needs `az login` + **Foundry
  User** role) vs. `server/lib/foundryAgent.js`'s `ManagedIdentityCredential`
  / `api/src/lib/foundryAgent.js`'s `ClientSecretCredential` (prod via
  `AZURE_TENANT_ID`/`AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET`) — the two
  copies differ here, matching each environment's auth model.
- **No rate limiting, no cost ceiling.** `/api/chat` is `authLevel:
  'anonymous'`/unauthenticated — anything hitting it (with a cache miss)
  triggers a real paid Foundry call, with no per-IP/session quota anywhere
  in the code.

**Orphaned, unused code from an earlier, reverted approach:** `server/lib/
braveSearch.js`, `server/lib/productLookup.js` (Brave Search + Amazon
JSON-LD scraping), the `/api/products/search` endpoint, and
`ProductConfirmCard.jsx` all still exist but are disconnected from the
current flow — `Home.jsx` never calls `/api/products/search` and never
renders `ProductConfirmCard`. These predate the pivot to the Foundry agent
and haven't been cleaned up.

## Response cache & demo mode (implemented)

`responseCache.js` (`server/lib/` and the near-identical `api/src/lib/`
mirror) holds a small hardcoded array (`CACHED_ASSESSMENTS`) of hand-written
product assessments, matched by substring against each entry's `aliases`
list. **This cache is checked first, unconditionally, before ever
considering Foundry** — a hit needs no Azure credentials and never touches
the network. `simulateThinkingDelay()` (900–2100ms) is awaited before
returning a cache hit or a demo-mode refusal, so it doesn't read as
obviously instant/fake next to a real Foundry round trip.

- `DEMO_MODE=true` (env var) only changes what happens on a **miss**: refuse
  gracefully ("Demo mode only has data for a few products: ...") instead of
  falling through to `invokeFoundryAgent`. Without it, a miss behaves exactly
  as it always did — attempts the real Foundry call, 500s if credentials
  aren't configured.
- Currently seeded with 3 products (iPhone 15 Pro, Nike Air Force 1,
  Patagonia Better Sweater Fleece). **The dimension scores/explanations are
  AI-generated illustrative placeholder content, not real researched-and-
  cited data** — every `sources` array is deliberately left empty rather
  than inventing citations. This does not meet BACKLOG.md's D2 bar ("every
  claim needs a source URL and a tier"); treat it as UI/plumbing test
  fixtures, not credible research, unless real research is used to replace
  the entries.
- Distinct from BACKLOG.md's A5 ("Cache + freshness, 7-day TTL"), which
  describes caching *real* Foundry responses to cut cost on repeat queries —
  that's still unbuilt. This cache never stores anything Foundry actually
  said; it's a fixed, hand-authored lookup table.
- To run locally with **zero Azure setup**: `npm run dev`, then ask about one
  of the 3 seeded products — works with no `.env` at all. Anything else
  falls through to the real (uncredentialed, erroring) Foundry path unless
  `DEMO_MODE=true` is also set.

## Known gaps / next steps

- Product lookup has no real evidence/retrieval behind it — see "Product
  lookup" above. This is the single biggest gap relative to what
  `AssessmentCard`'s UI implies (sourced, verified claims).
- No rate limiting or cost ceiling on `/api/chat` — a real risk once
  Foundry credentials are live in production (see "Product lookup").
- The response cache's 3 entries are placeholder content, not real research
  (see "Response cache & demo mode" above).
- `braveSearch.js`, `productLookup.js`, `/api/products/search`, and
  `ProductConfirmCard.jsx` are orphaned/dead code from a reverted approach —
  either remove or decide whether to revive them.
- No tests, no CI.
- `About`, `Capstone Paper`, and `Technical Overview` pages are placeholder
  text only — no real content yet.
- No "start a new chat" affordance beyond navigating back to `/` (e.g. the
  logo link) — works, but isn't an explicit button.
