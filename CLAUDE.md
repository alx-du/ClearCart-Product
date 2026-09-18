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
    ChatInput.jsx            — the pill-shaped message input + send button;
                               `size="large"` is the centered opening-screen variant
    AssessmentCard.jsx       — the rubric result card (dimensions, coverage badges,
                               expandable sources, conclusion). Wired in and used.
    ProductConfirmCard.jsx   — the "Found it!" card for one candidate: thumbnail
                               (hidden if it fails to load), name, source link,
                               Yes / "No, show another" buttons, and "← Back"
                               (from the second result on)
  hooks/
    useCarts.js               — subscribes a component to the carts localStorage store
  lib/
    carts.js                  — localStorage-backed chat history ("carts") CRUD
  pages/
    Home.jsx                  — the chat page: opening screen → product lookup &
                                 confirm → assessment → follow-ups (see "Chat /
                                 history behavior"); POSTs to /api/resolve-product
                                 and /api/chat
    About.jsx, CapstonePaper.jsx, TechnicalOverview.jsx — placeholder content pages

server/                    — Express app for local dev (`node server/index.js`)
  index.js                  — /api/resolve-product, /api/chat
  lib/
    foundryAgent.js          — calls the deployed Foundry agent; also `invokeModel`,
                               a plain (agent-less) model call for utility tasks
    responseCache.js         — hand-seeded cache checked before ever calling Foundry
                               or Tavily (also exports simulateThinkingDelay)
    tavilySearch.js          — product-name lookup: Tavily search + model naming
                               (title-cleanup heuristics as the fallback)
    productLookup.js         — JSON-LD product-page parser, orphaned (no caller —
                               its only caller, a Brave-Search-powered
                               /api/products/search route, was removed; see below)

api/                        — Azure Functions app (separate deploy unit, own
                               package.json), mirrors server/'s HTTP logic
  src/
    functions/chat.js, resolveProduct.js, health.js
    lib/foundryAgent.js, responseCache.js, tavilySearch.js
                                           — near-duplicates of server/lib/*
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

- Primary accent: **`accent-800`** (= Tailwind teal-800) — solid buttons,
  badges, the user's chat bubble, the assessment "Conclusion" block, headings,
  and the sidebar's active pill. It replaced teal-600 for solid fills, where
  white text was only 3.7:1 (fails AA); white on accent-800 is 7.5:1 and hover
  is `accent-900` (9.4:1). `accent-600` (= teal-600) remains only for the input
  border and focus rings (3.7:1, enough for non-text UI); `accent-700` is used
  for score dots and sidebar icons. **Components use `accent-*` classes, never
  raw `teal-*`**; the four `--color-accent-*` values in `index.css` are copies
  of Tailwind's teal-600…900, so editing them retunes the whole app. A muted,
  half-saturation variant (#375956) was tried and rejected in favor of the
  original teal.
- **Page theme:** the main area is flat white (a soft mist gradient was tried
  and rejected). Content sits in white **`.panel`** cards (defined in
  `index.css`: rounded, soft teal-tinted shadow, hairline ring) — chat bubbles,
  the confirm and assessment cards, starter prompts and the sidebar panels all
  use it, so on a white page they separate by shadow and ring only; raise the
  ring opacity if they look faint. Outline buttons are `border-accent-800` /
  `text-accent-800`, and every hover uses the same `mist-300` tint as the
  sidebar. The chat input floats (no bar or top border) with an `accent-600`
  border.
  The `mist-100/200/300` tints and `accent-*` shades are custom theme colors in
  `index.css`.
- Base font size bumped site-wide from 16px → 18px via `html { font-size:
  112.5% }` in `src/index.css`, rather than overriding every Tailwind text
  utility individually.
- High-contrast text everywhere: dark gray-900 text on white/light
  backgrounds instead of white-on-dark, larger touch targets (chat input,
  buttons, nav links all have generous padding).
- The active sidebar nav link renders as a solid white pill (not just a bold
  font-weight change) — bold-only state changes are hard to perceive, a
  solid state change isn't.
- The sidebar is a light, airy design: a soft teal vertical gradient
  (`bg-linear-to-b from-mist-100 via-mist-200 to-mist-300`) with two pale glow
  shapes and a faint dot texture, behind three **white panels** (logo, nav,
  "Previous Carts" list) lifted by a soft shadow and hairline ring. The `mist-*`
  tints are custom theme colors in `index.css`: Tailwind teal's hue and
  lightness at about half the saturation, because v4's teal-200/300 read as neon
  turquoise. Lightness is what sets text contrast, so adjust chroma freely but
  keep lightness. No text sits on the gradient — all of it is dark on white
  (`slate-800` 14.6:1, `accent-800` headings 7.5:1, `slate-600` helper text
  7.6:1). The active nav link is a solid `bg-accent-800` pill with white text
  (7.5:1; teal-700 was judged too light). Hover is `mist-300` (`teal-50` was
  invisible on white at 1.0:1; mist-300 is 1.5:1 and dark text on it is 9.9:1);
  focus is a solid `accent-600` ring (3.7:1 on white). The trade-off of the light
  look is low panel/background separation (1.1–1.5:1), which the shadow and
  ring make up for — if panels blur into the background, deepen the gradient
  stops rather than lightening the panels. Past-cart rows are plain text (no
  resting box, no count badge, no dots). Earlier dark-teal and amber→rose
  "sunset" versions existed; when trying other palettes, keep dark text on the
  white panels and re-check contrast with Tailwind's real color values.

## Chat / history behavior (implemented)

- **One session = one product.** The flow in `Home.jsx`:
  1. *Opening screen*: the original front page — "ClearCart 🛒" heading and the
     tagline "Let's look at a product together." (restored from the initial
     design; a later commit had swapped in "Shop with more confidence") — with a
     large input directly below the tagline so the next step is obvious, and no
     starter prompts. Submitting the first search moves the input to the
     bottom bar with a View Transition (`.chat-input-shell` in `index.css`;
     browsers without the API swap instantly, reduced-motion disables it). The
     mobile header is hidden on this screen since the heading already says it.
  2. *Lookup*: the input text — a product name or a pasted product link — goes
     to `/api/resolve-product` (Tavily, then a small model call that names the
     product and picks a photo). The result is shown as a `ProductConfirmCard`
     with a thumbnail; "No, show another"
     cycles through up to 3 candidates, then offers a retype, and "← Back"
     (from the second result on) steps back without rejecting anything — so all
     three can be reviewed before committing. The input is
     locked while a candidate awaits a decision. Nothing is saved yet.
  3. *Confirm*: "Yes" creates the cart (history entry) and immediately requests
     the initial assessment (`/api/chat`, `mode: 'assessment'`, sending just the
     confirmed name). A failed assessment shows a "Try again" button.
  4. *Follow-ups*: once the assessment finishes, the three starter prompts
     appear. The input is now a follow-up box (`/api/chat`, `mode: 'chat'`,
     with the confirmed name + assessment JSON + prior Q&A as context). The
     starters disappear after the first follow-up. Researching a different
     product means starting a new chat (logo link).
- Message shapes carry a `kind`: `search`, `confirm`, `assessment`,
  `followup`, `answer`. `toModelMessages` decides what the model sees (raw
  search text and confirm-card steps are UI-only). Carts saved before this
  flow have no `kind`; they still load and work as follow-up sessions.
- **One sidebar history entry per chat session, not per message.** The cart is
  created when the user confirms a product (`lib/carts.js: addCart`); every
  later message in that session updates that same cart in place
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

Two backend endpoints (`server/index.js` in dev; `api/src/functions/` in prod —
same logic, duplicated):

- `POST /api/resolve-product` `{ query }` → `{ candidates: [{ name, url,
  source, image }], message? }`. Checks the response cache first (a seeded
  product resolves with no external call and has `image: null`; **links skip
  the cache**, because short aliases like "af1" would otherwise match random
  characters inside a product ID in a URL), else `tavilySearch.js`. For a text
  query: Tavily search (query prefixed with "buy"; a small `exclude_domains`
  list drops Wikipedia/Yahoo/Reddit/etc.; `include_images` +
  `include_image_descriptions` return retailer product photos in the same
  request), then **one plain model call** (`invokeModel` →
  `FOUNDRY_MODEL_DEPLOYMENT`, not the ClearCart agent, so it doesn't depend on
  the agent's stored instructions) that turns the results into up to 3
  shopper-style names ("Coca-Cola Soda", not the page title "Shop Coca-Cola
  Products: Find Drinks Near You | Coca-Cola US"), each linked to the result
  that supports it, plus the listed photo (matched by description; each photo
  is used for at most one candidate, https only). The first version was
  Tavily-only with title cleanup and produced marketing-page titles; that
  heuristic (`toCandidates`) now only runs as a **fallback** if the model call
  fails, and logs a warning when it does. A text lookup costs one Tavily search
  plus one small model call (~5–8s end to end).
  For a **pasted link** (`normalizeUrlInput`: `http(s)://…` or `www.…`, no
  spaces), Tavily **Extract** reads the page (Tavily fetches it, so this server
  never requests a user-supplied URL) and the model names the single product on
  it and picks its photo from the page's images (~2s). A page that isn't one
  product (home page, category, article) returns `message: "That link doesn't
  look like a single product page…"`. If Extract can't read the page (e.g. a
  scraper-blocking retailer), it falls back to a normal search using the link
  text.
- `POST /api/chat` `{ mode, messages }` → `{ reply, assessment }`.
  `mode: 'assessment'` (default) returns the scoring JSON and is served from
  the cache when the name matches; `mode: 'chat'` returns a plain-text answer,
  never touches the cache, and is unavailable in `DEMO_MODE`. When
  `assessment` is present, `AssessmentCard` renders it (five dimensions ×
  {score, coverage, explanation, sources}, plus a conclusion).

See "Response cache & demo mode" below for the layer in front of both.

**How the agent itself works:**
- `scripts/createAgent.js` (`npm run agent:create`, run manually/occasionally,
  never per-request) provisions a versioned Azure AI Foundry "prompt agent" —
  a stored system prompt + model deployment (`FOUNDRY_MODEL_DEPLOYMENT`, e.g.
  `gpt-5-mini`). That's where the actual instructions live at runtime; the
  script is just the source text used to push them there.
- `foundryAgent.js: invokeFoundryAgent(messages, { mode })` calls that agent by
  name (`FOUNDRY_AGENT_NAME`) via the OpenAI-compatible Responses API
  (`openAI.responses.create`). In `assessment` mode it re-appends a shorter
  JSON-shape reinforcement to the last user message each request, retries once
  with a stricter format correction if the reply doesn't parse as the expected
  JSON, and defensively drops any source without a valid `http(s)` URL. In
  `chat` mode it appends a plain-text instruction instead and returns the raw
  text.
- **Republishing the agent is required for follow-ups to work well.** The stored
  instructions used to force a JSON reply on every message; `createAgent.js`
  now says "JSON only when the request includes assessment-format
  instructions, otherwise plain text". That edit only takes effect after
  someone runs `npm run agent:create` (creates a new agent version in Azure) —
  until then the live agent still answers follow-ups with assessment JSON.
- **No retrieval, no tools, no database.** The agent is `kind: 'prompt'` —
  one LLM call against training-data knowledge, not live web search (Tavily is
  used only to resolve the product *name*, before the agent is ever called). It's
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
- **No rate limiting, no cost ceiling.** `/api/chat` and `/api/resolve-product`
  are `authLevel: 'anonymous'`/unauthenticated — anything hitting them (with a
  cache miss) triggers a real paid Foundry call or Tavily credit, with no
  per-IP/session quota anywhere in the code.
- Tavily needs `TAVILY_API_KEY` (in `.env` locally; an application setting on
  Static Web Apps). Without it a non-cached lookup returns a 500. The naming
  step also needs `FOUNDRY_PROJECT_ENDPOINT` + `FOUNDRY_MODEL_DEPLOYMENT` and
  Azure credentials at *runtime* (previously the model deployment name was only
  needed by `agent:create`); without them it falls back to title cleanup.
- **Unverified for production:** the Static Web Apps app registration is
  assigned a role meant for invoking the *agent*. The naming call hits the
  project's model endpoint directly, so that identity may need an additional
  role. It works locally with a developer identity; it has not been tried with
  the production service principal.

**Orphaned, unused code from an earlier, reverted approach:** the Brave
Search side of it (`braveSearch.js`, the `/api/products/search` endpoint,
`BRAVE_API_KEY`) has been pruned. `server/lib/productLookup.js` (the JSON-LD
scraper that consumed Brave's results) is still present with no caller at all.

## Response cache & demo mode (implemented)

`responseCache.js` (`server/lib/` and the near-identical `api/src/lib/`
mirror) holds a small hardcoded array (`CACHED_ASSESSMENTS`) of hand-written
product assessments, matched by substring against each entry's `aliases`
list. **This cache is checked first, unconditionally, before ever
considering Tavily or Foundry** — both `/api/resolve-product` and
`/api/chat` (assessment mode) consult it, and a hit needs no Azure or Tavily
credentials and never touches the network. `simulateThinkingDelay()`
(900–2100ms, exported from `responseCache.js`) is awaited before returning a
cache hit or a demo-mode refusal, so it doesn't read as obviously
instant/fake next to a real round trip.

- `DEMO_MODE=true` (env var) only changes what happens on a **miss**: refuse
  gracefully ("Demo mode only has data for a few products: ...") instead of
  falling through to Tavily or `invokeFoundryAgent`; chat-mode follow-ups get
  a "demo mode only shows saved assessments" reply. Without it, a miss
  behaves as normal — attempts the real Tavily/Foundry call, 500s if
  credentials aren't configured.
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
- To run locally with **zero external setup**: `npm run dev`, then enter one
  of the 3 seeded products — lookup, confirm and assessment all work with no
  `.env` at all. Follow-up questions do not (they need the live agent, or get
  the demo-mode notice). Anything else falls through to the real Tavily/Foundry
  path unless `DEMO_MODE=true` is also set.

## Known gaps / next steps

- Product lookup has no real evidence/retrieval behind it — see "Product
  lookup" above. This is the single biggest gap relative to what
  `AssessmentCard`'s UI implies (sourced, verified claims).
- No rate limiting or cost ceiling on `/api/chat` — a real risk once
  Foundry credentials are live in production (see "Product lookup").
- The response cache's 3 entries are placeholder content, not real research
  (see "Response cache & demo mode" above).
- `productLookup.js` is orphaned/dead code from a reverted approach — either
  remove it or decide whether to revive it (Brave Search itself has already
  been pruned).
- Run `npm run agent:create` to publish the new agent instructions, or
  follow-up answers will keep coming back as assessment JSON (see "Product
  lookup").
- Name resolution depends on the model behaving: it can still propose a
  variant the user didn't mean (that's what "No, show another" is for), and
  it adds roughly 3s to each lookup.
- Product photos are hotlinked from retailer CDNs: they can break or move
  (the card hides a failed image), may show a different pack size than the
  name, and the 3 seeded demo products have none (a cache hit makes no
  network call). The photo is only on the confirm card; it isn't saved with
  the cart or shown on the assessment card.
- No tests, no CI. (The Home.jsx flow was verified with a throwaway jsdom
  harness during development, not a checked-in test suite; the view-transition
  animation and layout have not been checked in a real browser.)
- `About`, `Capstone Paper`, and `Technical Overview` pages are placeholder
  text only — no real content yet.
- No "start a new chat" affordance beyond navigating back to `/` (e.g. the
  logo link) — works, but isn't an explicit button. This matters more now that
  a session is scoped to one product: after the assessment, the input is a
  follow-up box, so researching another product means starting a new chat.
