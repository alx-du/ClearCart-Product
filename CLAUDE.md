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
- **Backend: one Express server** (`server/`), for local dev (`npm run
  dev:api`) and production alike. **No Azure anywhere** — the app previously ran on
  Azure Static Web Apps + managed Functions (`api/`, a duplicate of `server/`)
  with a Microsoft Foundry prompt agent; all of that was removed on 2026-09-28.
- **Hosting:** the frontend is a static build on **GitHub Pages**
  (`.github/workflows/deploy-pages.yml`); the Express server is self-hosted
  separately (e.g. on the CoLab's B3IQ machine) and called cross-origin.
- **Model access:** plain `fetch` to any **OpenAI-compatible
  `/v1/chat/completions` endpoint** (`server/lib/modelClient.js`), normally the
  Ethical Tech CoLab **pages-ai-proxy**
  (github.com/Ethical-Tech-CoLab/pages-ai-proxy, private org repo), which
  injects the provider token and routes the model id to a cloud API or a local
  B3IQ GPU model. Which model to use is deliberately undecided — it's just
  `AI_MODEL`. See below.
- No test framework set up (`npm test` runs nothing).

Run locally: `npm install && npm run dev` (runs Express on :8787 and Vite on
:5173 concurrently, via `concurrently`; Vite proxies `/api/*` to Express in
dev). See "Product lookup" for what does/doesn't need credentials.

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
  main.jsx                 — BrowserRouter with basename = Vite's BASE_URL (the
                             Pages build uses base /<repo>/)
  hooks/
    useCarts.js               — subscribes a component to the carts localStorage store
  lib/
    carts.js                  — localStorage-backed chat history ("carts") CRUD
  pages/
    Home.jsx                  — the chat page: opening screen → product lookup &
                                 confirm → assessment → follow-ups (see "Chat /
                                 history behavior"); POSTs to /api/resolve-product
                                 and /api/chat, prefixed with VITE_API_BASE_URL (empty in
                                 dev; the server's URL in the Pages build)
    About.jsx, CapstonePaper.jsx, TechnicalOverview.jsx — placeholder content pages

server/                    — the only backend (`node server/index.js`)
  index.js                  — /api/resolve-product, /api/chat, CORS for CORS_ORIGINS,
                               and serves dist/ (so it can host the whole app alone)
  lib/
    modelClient.js           — chat-completions calls: `invokeAssistant` (assessment /
                               follow-up, with the ClearCart system prompt) and
                               `invokeModel` (plain call for utility tasks like naming)
    responseCache.js         — hand-seeded cache checked before ever calling the model
                               or Tavily (also exports simulateThinkingDelay)
    tavilySearch.js          — product-name lookup: Tavily search + model naming
                               (title-cleanup heuristics as the fallback)
    productLookup.js         — JSON-LD product-page parser, orphaned (no caller —
                               its only caller, a Brave-Search-powered
                               /api/products/search route, was removed; see below)

.github/workflows/deploy-pages.yml — builds the frontend with --base=/<repo>/ and
                               VITE_API_BASE_URL from the CLEARCART_API_URL repo
                               variable, copies index.html → 404.html (Pages has no
                               SPA rewrites), deploys to GitHub Pages
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

## Product lookup — implemented, via an OpenAI-compatible model call (no retrieval)

Two backend endpoints in `server/index.js`:

- `POST /api/resolve-product` `{ query }` → `{ candidates: [{ name, url,
  source, image }], message? }`. Checks the response cache first (a seeded
  product resolves with no external call and has `image: null`; **links skip
  the cache**, because short aliases like "af1" would otherwise match random
  characters inside a product ID in a URL), else `tavilySearch.js`. For a text
  query: Tavily search (query prefixed with "buy"; a small `exclude_domains`
  list drops Wikipedia/Yahoo/Reddit/etc.; `include_images` +
  `include_image_descriptions` return retailer product photos in the same
  request), then **one plain model call** (`invokeModel` →
  `AI_NAMING_MODEL`, defaulting to `AI_MODEL`, without the ClearCart system
  prompt) that turns the results into up to 3
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

**How the model is called:**
- `modelClient.js: chatCompletion` POSTs `{ model, messages }` to `AI_ENDPOINT`
  and reads `choices[0].message.content`, stripping any inline
  `<think>…</think>` block (local reasoning models emit one, and its braces
  would confuse JSON parsing). Headers: `Authorization: Bearer AI_API_KEY` only
  if set (the proxy supplies its own token, so normally unset), and
  `Origin: AI_PROXY_ORIGIN` — **the proxy 403s any request with no Origin**
  unless its `ALLOWED_ORIGINS` is `*`, and a server-side fetch sends none.
  Timeouts: 120s for assessments/follow-ups (local models cold-start slowly),
  20s for naming. `AI_NAMING_REASONING_EFFORT`, if set, is passed as
  `reasoning_effort` on the naming call only (gpt-5-mini wants `minimal` for
  speed; models that don't know the parameter may reject it, so it's opt-in).
- `invokeAssistant(messages, { mode })` sends a **system prompt from code**
  (`SYSTEM_PROMPT`) plus the conversation. This replaced the Foundry agent's
  stored instructions, so there is no "republish the agent" step any more. In
  `assessment` mode it appends the JSON-shape instructions to the last user
  message, retries once with a stricter format correction if the reply doesn't
  parse, and drops any source without a valid `http(s)` URL. In `chat` mode it
  appends a plain-text instruction and returns the raw text.
- **No retrieval, no tools, no database.** One LLM call against the model's
  training-data knowledge, not live web search (Tavily is used only to resolve
  the product *name*). The model is instructed to self-report
  `coverage: unknown`/`claimed` rather than fabricate a `scored` result, but
  nothing verifies that. This matches BACKLOG.md's A3 item ("Evidence
  orchestration: Tavily search → typed findings → deterministic gating"),
  which is *not yet built*. Adding real evidence-gathering would mean a
  fetch-and-check step (or function-calling loop) in this server. Small local
  models behind the proxy will also be weaker at the strict JSON and at
  product knowledge than a hosted model — the retry helps with the former only.
- **No rate limiting, no cost ceiling** — not in this server and not in the
  pages-ai-proxy either (its origin allow-list is a browser-only control; any
  non-browser client can send a fake Origin). `/api/chat` and
  `/api/resolve-product` are unauthenticated, so a cache miss triggers a real
  model call (paid, if the proxy routes to a cloud API) or Tavily credit.
- Tavily needs `TAVILY_API_KEY` (in `.env`). Without it a non-cached lookup
  returns a 500. Naming needs `AI_ENDPOINT` + `AI_MODEL`; without them it
  falls back to title cleanup.
- **Not yet deployed:** the GitHub Pages workflow, the self-hosted server, and
  a CoLab-hosted proxy have not been set up. Verified only locally, against the
  real pages-ai-proxy `local-server.mjs` with a mock upstream.

**Orphaned, unused code from an earlier, reverted approach:** the Brave
Search side of it (`braveSearch.js`, the `/api/products/search` endpoint,
`BRAVE_API_KEY`) has been pruned. `server/lib/productLookup.js` (the JSON-LD
scraper that consumed Brave's results) is still present with no caller at all.

## Response cache & demo mode (implemented)

`responseCache.js` (`server/lib/`) holds a small hardcoded array (`CACHED_ASSESSMENTS`) of hand-written
product assessments, matched by substring against each entry's `aliases`
list. **This cache is checked first, unconditionally, before ever
considering Tavily or the model** — both `/api/resolve-product` and
`/api/chat` (assessment mode) consult it, and a hit needs no model or Tavily
credentials and never touches the network. `simulateThinkingDelay()`
(900–2100ms, exported from `responseCache.js`) is awaited before returning a
cache hit or a demo-mode refusal, so it doesn't read as obviously
instant/fake next to a real round trip.

- `DEMO_MODE=true` (env var) only changes what happens on a **miss**: refuse
  gracefully ("Demo mode only has data for a few products: ...") instead of
  falling through to Tavily or `invokeAssistant`; chat-mode follow-ups get
  a "demo mode only shows saved assessments" reply. Without it, a miss
  behaves as normal — attempts the real Tavily/model call, 500s if
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
  describes caching *real* model responses to cut cost on repeat queries —
  that's still unbuilt. This cache never stores anything a model actually
  said; it's a fixed, hand-authored lookup table.
- To run locally with **zero external setup**: `npm run dev`, then enter one
  of the 3 seeded products — lookup, confirm and assessment all work with no
  `.env` at all. Follow-up questions do not (they need a live model, or get
  the demo-mode notice). Anything else falls through to the real Tavily/model
  path unless `DEMO_MODE=true` is also set.

## Known gaps / next steps

- Product lookup has no real evidence/retrieval behind it — see "Product
  lookup" above. This is the single biggest gap relative to what
  `AssessmentCard`'s UI implies (sourced, verified claims).
- No rate limiting or cost ceiling on `/api/chat` — a real risk once a
  paid upstream is live behind the proxy (see "Product lookup").
- The response cache's 3 entries are placeholder content, not real research
  (see "Response cache & demo mode" above).
- `productLookup.js` is orphaned/dead code from a reverted approach — either
  remove it or decide whether to revive it (Brave Search itself has already
  been pruned).
- Deployment after the Azure removal isn't set up: enable Pages (Source:
  GitHub Actions), set the `CLEARCART_API_URL` repo variable, host the Express
  server with `CORS_ORIGINS`, and get a pages-ai-proxy running. The old Azure
  Static Web App / Foundry resources still exist in Azure until someone
  deletes them.
- Model choice is open (`AI_MODEL`); a local B3IQ model hasn't been tried
  against the assessment prompt.
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
