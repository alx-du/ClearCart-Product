# ClearCart

A product research site. A user searches for a product; if ClearCart has
researched it, they get a page rating it on five separate dimensions (planet
impact, people & supply chain, quality, value, transparency) with a source
for every fact — similar to how a capstone research paper's rubric would
score a product. If it hasn't, they get what ClearCart knows about related
records (the brand, its owner, its factories, country risk lists) and can ask
for the product to be researched. Positioned as a curation/review board that
credits contributors (content creators, researchers), not a certified source
of truth. **No visitor request calls an LLM** (decided with Alex, Oct 2026:
paying per visitor for model calls isn't sustainable).

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
- **Catalogue data:** JSON files in `server/data/` loaded at startup (no
  database yet; BACKLOG mentions a `server/db/schema.prisma`, but it doesn't
  exist). Runtime state (search cache, research requests) is written to
  `server/data/runtime/` (gitignored).
- **Web search:** Tavily, read with text patterns, never a model.
- **Model access (never in a request path):** `server/lib/modelClient.js` calls
  any OpenAI-compatible `/v1/chat/completions` endpoint, normally the Ethical
  Tech CoLab **pages-ai-proxy** (github.com/Ethical-Tech-CoLab/pages-ai-proxy,
  private org repo). Used only by the offline description build (`npm run
  descriptions:build`, see "Product descriptions").
- No test framework set up (`npm test` runs nothing).

Run locally: `npm install && npm run dev` (runs Express on :8787 and Vite on
:5173 concurrently, via `concurrently`; Vite proxies `/api/*` to Express in
dev). The catalogue needs no credentials; only the web lookup needs
`TAVILY_API_KEY` (without it, lookups use the search words alone).

Node/npm were not preinstalled in the dev sandbox this was built in — if
that's true in a fresh environment too, install via `apt-get install -y
nodejs npm` (needs sudo/interactive auth, so the user usually runs it
themselves) before `npm install` will work. `package.json` pins
`engines.node` to `>=22.12.0 <23`.

## File map

```
src/
  App.jsx                  — routes (all under a shared Layout)
  main.jsx                 — BrowserRouter with basename = Vite's BASE_URL (the
                             Pages build uses base /<repo>/)
  components/
    Layout.jsx              — main area (scrolls) + Sidebar; a slim top bar with
                               Search/Catalogue links on phones (sidebar is md+ only)
    Sidebar.jsx              — persistent right sidebar: logo, nav, "Previous Carts"
                               (recently viewed products and lookups)
    SearchInput.jsx          — the pill-shaped search box; `size="large"` on the
                               opening screen
    Badges.jsx               — CoverageBadge (4 coverage states + "context only" and
                               "country level"), ScoreDots, DemoNotice
    Evidence.jsx             — FactItem / GapItem / EvidenceList / SourceLine: a fact
                               with its source tier, links, date and contributor; a
                               gap as a dashed "Not public: …" box
    PageStatus.jsx           — Loading, LoadError, BackToSearch
  hooks/
    useApi.js                 — GET a url; result keyed by url (no setState-in-effect)
    useHistory.js             — subscribes to the history localStorage store
  lib/
    api.js                    — getJson/postJson, prefixed with VITE_API_BASE_URL
                                 (empty in dev; the server's URL in the Pages build)
    history.js                — localStorage "Previous Carts" list
  pages/
    Home.jsx                  — opening screen; with ?q= shows catalogue results,
                                 known brands, and a "Look up on the web" link
    Product.jsx               — /product/:id, a researched product
    Lookup.jsx                — /lookup?q=, related knowledge for an unresearched
                                 product + the research-request button
    Catalogue.jsx             — /catalogue (?brand=id): product list, also the brand page
    About.jsx, CapstonePaper.jsx, TechnicalOverview.jsx — placeholder content pages

server/                    — the only backend (`node server/index.js`)
  index.js                  — routes (below), CORS for CORS_ORIGINS, per-IP limits,
                               serves dist/ (so it can host the whole app alone)
  data/
    catalogue.json           — the catalogue: products, organizations, sites,
                               supply-chain nodes, materials, facts, gaps,
                               assessments, sources, contributors. DEMO DATA ONLY
                               (fictional Hartwell / Corvane Group)
    risk-reference.json      — government risk-list rows (DOL goods list etc.);
                               deliberately EMPTY — see "Lookup ladder"
    descriptions.json        — generated description cache (committed once built;
                               doesn't exist until the first `descriptions:build`)
    runtime/                 — gitignored: web-lookups.json, requests.json
  lib/
    catalogue.js             — loads the data; search; collectForProduct (the
                               fact-collection rules); getProductView
    descriptions.js          — dimension summaries + conclusion: inputs, hash,
                               cache lookup (descriptions.json), template fallback
    descriptionModel.js      — writes one description with the model and checks it
                               (offline build only)
    webLookup.js             — observeProduct: brand/material/origin/maker/category
                               from the query + one cached Tavily search, by regex
    lookupLadder.js          — buildRelated: the related-knowledge page sections
    researchRequests.js      — request counts per normalized query
    rateLimit.js             — in-memory per-IP sliding-window limiter
    runtimeStore.js          — atomic JSON writes to data/runtime/
    tavilySearch.js          — Tavily calls. `searchListings` is used by the lookup;
                               the rest (`searchProductCandidates`, model naming)
                               is from the old chat flow and has no caller now
    modelClient.js           — OpenAI-compatible model calls; `invokeText` is used
                               by the description build; the rest has no caller
    productLookup.js         — JSON-LD product-page parser, orphaned (older still)

.github/workflows/deploy-pages.yml — builds the frontend with --base=/<repo>/ and
                               VITE_API_BASE_URL from the CLEARCART_API_URL repo
                               variable, copies index.html → 404.html (Pages has no
                               SPA rewrites), deploys to GitHub Pages

scripts/buildDescriptions.js — `npm run descriptions:build`: rewrites stale
                               descriptions (--dry-run lists them, --force all)

sandbox/ (gitignored)       — product-entry-example.txt, the schema sketch the
                               catalogue follows (sections referenced as "sandbox §N")
```

Routes: `/` (search), `/product/:id`, `/lookup?q=`, `/catalogue`, `/about`,
`/capstone-paper`, `/technical-overview`. All render inside `Layout`, so the
sidebar never unmounts between pages. A UI mockup of the search / product /
related pages is at https://claude.ai/artifact/LvfgLhgC39wohADjV1h8PX
(private to Kai unless shared).

## Design system

Redesigned away from the original mockup's dark-navy palette toward
something **bright, high-contrast, and easy to read for older users** — this
was an explicit ask, not just a style preference:

- Primary accent: **`accent-800`** (= Tailwind teal-800) — solid buttons,
  badges, the product page's "Conclusion" block and request card, headings,
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
  `index.css`: rounded, soft teal-tinted shadow, hairline ring) — search
  results, the product and lookup sections and the sidebar panels all
  use it, so on a white page they separate by shadow and ring only; raise the
  ring opacity if they look faint. Outline buttons are `border-accent-800` /
  `text-accent-800`, and every hover uses the same `mist-300` tint as the
  sidebar. The search box has an `accent-600` border.
  The `mist-100/200/300` tints and `accent-*` shades are custom theme colors in
  `index.css`.
- Base font size bumped site-wide from 16px → 18px via `html { font-size:
  112.5% }` in `src/index.css`, rather than overriding every Tailwind text
  utility individually.
- High-contrast text everywhere: dark gray-900 text on white/light
  backgrounds instead of white-on-dark, larger touch targets (search box,
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

## Search flow (implemented)

1. *Opening screen* (`/`): "ClearCart 🛒" and "Let's look at a product
   together." with a large search box.
2. *Catalogue results* (`/?q=…`): `GET /api/catalogue/search` — free, no
   external call. Words match as prefixes against product names, aliases,
   product line and brand, so typing a brand lists its products. Groups: "In our
   catalogue" (→ product page), "Brands we know" (→ `/catalogue?brand=`), and
   unless there's an exact match, "Look up “…” on the web" (→ `/lookup?q=`).
   The web lookup is a deliberate extra click so searches the catalogue can
   answer never spend a Tavily credit.
3. *Product page* (`/product/:id`): a key explaining the four coverage badges,
   then five dimension rows (score dots + coverage badge + one-line summary +
   chevron), each expanding to its evidence (facts and gaps; one row open at a
   time); a material donut chart in the header;
   "Where it's made" tier 1–4; "Who reported this" (contributors with their
   disclosures); conclusion; more from the brand. No composite score.
4. *Related-knowledge page* (`/lookup?q=`): see "Lookup ladder". An exact
   catalogue match redirects to the product page instead.
- "Previous Carts" in the sidebar now lists recently viewed product pages and
  lookups (`lib/history.js`, localStorage `clearcart_history`, max 30, one entry
  per page). The old chat-session carts (`clearcart_carts`) are ignored.
- The chat flow (confirm card, live model assessment, follow-up questions) and
  `/api/resolve-product` + `/api/chat` were removed on the `catalogue-lookup`
  branch, along with the 3 hand-written real-brand cache entries
  (`responseCache.js`), whose unsourced AI-written facts shouldn't appear as
  catalogue facts.

## Catalogue data (implemented, demo content)

`server/data/catalogue.json`, shaped like the sandbox schema:
- **Things:** `products` (with `productLine`, `category`, `aliases`),
  `organizations` (`type` brand / parent_company / contract_manufacturer /
  supplier, `parent`), `sites` (factories, owned by an org), `sources` (each with
  a `tier`: regulatory, third_party_audit, investigative, first_hand_report,
  self_reported), `contributors` (handle, platform, about, disclosure).
- **A product's supply chain:** `nodes` (product, tier 1–4, role, site, optional
  production `line`, coverage, sources, contributor, validFrom/validTo) and
  `materials`. Nodes are per product; sites are shared, which is how two
  products share a factory's facts. (Supplier→customer links between nodes from
  the sketch aren't implemented; nothing displays them yet.)
- **Claims:** `facts` (subject = product/site/org id, statement, dimension,
  coverage, `scope`, sources, contributor, validAsOf) and `gaps` (what's
  missing, where we looked, when; optional tier). Scope: `product`,
  `whole_site`, `whole_org`, `line:<name>`, `products:<id>,<id>`.
- **`assessments`:** per-product score and coverage for each dimension, set by
  people, not computed. Rule kept from BACKLOG: claimed/unknown → null score.
  No prose lives here any more: summaries and the conclusion are generated
  (see "Product descriptions").
- **Fact collection** (`collectForProduct`, sandbox §9): the product's own facts,
  then for each current node its site's and the site owner's facts, then the
  brand's and its parents'. Drops facts whose scope excludes the product (a
  `line:` the node isn't on, a `products:` list without it) and site facts dated
  before the node's validFrom. A fact reached through a node is capped at the
  node's coverage — e.g. the joggers' factory link is only "claimed" (Hartwell
  says so), so the factory's scored SA8000 audit shows as claimed there.
- **All current content is fictional demo data** (`"demo": true`; the pages
  show a "Demo data" notice). example.com URLs are placeholders; the UFLPA and
  UK registry links are real lists, but the facts citing them are demo facts.
  Real entries need real research, each fact with a real source.

## Lookup ladder (implemented)

`GET /api/lookup?q=` (`webLookup.js` + `lookupLadder.js`, sandbox §10):
1. Exact catalogue match → `{ kind: 'product', productId }` (frontend redirects).
2. Otherwise `observeProduct`: brand / maker from the query words; then, if
   `TAVILY_API_KEY` is set, not `DEMO_MODE`, and within limits, **one** Tavily
   search (`"buy <query>"`), read by regex: brand (aliases in titles/domains),
   "NN% fibre" composition, "Made in X" (country names from
   `Intl.DisplayNames`, plus a few aliases like "Viet Nam"), named makers, and a
   category from keywords (apparel/footwear/electronics). Cached per normalized
   query for 7 days (`runtime/web-lookups.json`).
3. `buildRelated` sections, each labelled with what it's about: reported maker's
   factory (if a listing names one we know), the brand, each owner up the chain
   (all capped at **inferred**), the brand's other factories (**context only**,
   never counted), and country risk (category goods × origin against
   `risk-reference.json`, plus a cotton-origin gap). Dimension tiles show
   coverage only — **nothing on the page is scored**. Plus researched sibling
   products and the request count.
- **Limits / cost ceiling:** Tavily searches are limited to 15/hour per IP (cache
  hits don't count) and `TAVILY_DAILY_LIMIT` (default 200) per day in total;
  over either, the lookup uses the search words only and says so. Research
  requests (`POST /api/requests`) are limited to 30/hour per IP, and the button
  remembers per browser (localStorage `clearcart_requested`). Limits are in
  memory and reset on restart. Behind a tunnel/proxy, set `TRUST_PROXY` so
  `req.ip` is the visitor's.
- **`risk-reference.json` is empty on purpose.** The DOL List of Goods site
  refuses scripted downloads (403), and rows must not be typed from memory. Until
  someone downloads the list in a browser and fills the rows, the country section
  says "We haven't loaded the government risk lists yet".
- Verified with a stubbed Tavily (no credits spent) and in headless Chromium at
  1280px and 390px; not yet tried against live Tavily results.

## Product descriptions (implemented)

The one-line dimension summaries and the conclusion are written **from the
facts**, never typed in, so they can't drift from the evidence
(`descriptions.js`):
- **Inputs** per description: the product name, the dimension's score and
  coverage, its collected facts (id, statement, effective coverage, what it's
  about, source types) and gaps; the conclusion takes all five. Hashed as
  canonical JSON (sorted keys) with SHA-256, together with `PROMPT_VERSION`.
  Because the inputs are the *collected* facts, a change to a shared factory or
  brand fact invalidates every product that reaches it (tested: editing one
  factory audit made exactly 4 of 12 descriptions stale).
- **Cache:** `server/data/descriptions.json`, entries `{ product, key
  (dimension or "conclusion"), inputsHash, promptVersion, model, text, cites,
  generatedAt, reviewed }`. Old entries are kept as history. The server re-reads
  the file when it changes; no restart needed.
- **Serving:** if an entry's hash matches the current inputs, show it (origin
  `generated`, or `reviewed` once a person sets `"reviewed": true`); otherwise
  show **template text** built from the facts (strongest two facts + "Not
  public: …"; the conclusion lists which dimensions have independent evidence
  and the top gaps). **No visitor request calls a model.**
- **Building:** `npm run descriptions:build` rewrites every description with no
  matching entry, or whose entry came from a different model. `--dry-run` lists
  them; `--force` rewrites all. The team runs it after editing facts. Two
  providers:
  - **Claude** (`AI_DESCRIPTION_PROVIDER=anthropic`): `claudeClient.js`, the
    official `@anthropic-ai/sdk` (1.9), model `CLAUDE_MODEL` (default
    `claude-opus-5-5`), effort `high`, structured output
    (`output_config.format` json_schema; the schema is converted to Claude's
    subset: `additionalProperties: false` on every object, no min/maxItems),
    server-side refusal fallback (`fallbacks: "default"`, beta
    `server-side-fallback-2026-07-01`). Credentials: `ANTHROPIC_API_KEY` or an
    `ant auth login` profile (the SDK sends the key as `Authorization: Bearer`).
  - **OpenAI-compatible** (default): `modelClient.js` `invokeText` against
    `AI_ENDPOINT` (pages-ai-proxy, Ollama, …), model `AI_DESCRIPTION_MODEL` or
    `AI_MODEL`; `AI_JSON_MODE=true` sends the same schema as `json_schema`
    structured output (needed for small local models).
  - Tried locally with Ollama `qwen2.5:7b` (RTX 4060, 8 GB): with structured
    output the shape was always right, but 4 of 12 failed the gap check and
    several that passed overstated the facts (e.g. "fabric is certified
    organic" from a factory-line certification). Not good enough unreviewed.
- **Checks on model output** (`descriptionModel.js`, `checkDescription`): JSON
  `{sentences:[{text, cites}]}`; every sentence cites at least one fact/gap id
  from its input and no other ids; never "ethical", "sustainable",
  "eco-friendly", "guaranteed", "ensures", "safe to buy", "best"; "verified /
  proven / confirmed / definitely / certainly" only when every cited fact is
  scored; any "not public / unknown / no information" wording must cite a gap
  (no invented gaps), and if the input has gaps at least one is cited; at most
  2 sentences (3 for a conclusion) and 60 words (70). `PROMPT_VERSION` is
  `descriptions-v2`. These catch format and wording problems, not a sentence
  that quietly stretches a fact. A failed reply is retried
  once with the problems listed; if it fails again, nothing is cached and the
  page keeps the template.
- The page says summaries are written from each row's evidence; the conclusion
  is labelled "Built from" / "Written automatically from" / "… checked by the
  ClearCart team" by origin.
- The Claude path is verified only against a mock Anthropic API (request
  shape, fallbacks, refusal handling); it hasn't been run with a real key yet.
  `descriptions.json` currently holds the qwen2.5:7b output from the local run.
- **Known template weakness:** a fact capped by a weak supply-chain link (e.g.
  the joggers' factory audit, "claimed" because only Hartwell says they're made
  there) is stated plainly in the template sentence; only the badge carries the
  caveat.

## Model code

`modelClient.js`: `invokeText` is used by the description build. `invokeAssistant`
(the old chat assessment) and `invokeModel` + the model-based product naming in
`tavilySearch.js` have no caller since the chat flow was removed; they're kept
for other offline research (e.g. extracting facts from creator submissions, with
a "quote must appear in the source" check), never per visitor.

## Known gaps / next steps

- **The catalogue is demo data.** Two fictional products. Real entries need real
  research with real sources; there's no editor or ingestion path yet (facts are
  hand-edited JSON).
- `risk-reference.json` is empty (see "Lookup ladder"), so the country rung
  never shows a risk.
- No contributor submissions yet: contributors exist only as data. The mockup's
  "Contributors" nav item and "Share a report" links weren't built.
- No research workflow behind the request queue: counts are stored, nothing
  reads them yet.
- JSON files, not a database: fine for a demo, rewritten on every request
  count/cache write, single-process only.
- Rate limits are in memory (reset on restart, per process).
- Deployment after the Azure removal isn't set up: enable Pages (Source:
  GitHub Actions), set the `CLEARCART_API_URL` repo variable, host the Express
  server with `CORS_ORIGINS`. The old Azure Static Web App / Foundry resources
  still exist in Azure until someone deletes them.
- Generated descriptions are shown without review (`reviewed` is recorded but
  not required). Decide whether pages should show only reviewed entries; the
  local 7B model's output wasn't accurate enough to show unreviewed.
- Dead code: `productLookup.js`, `invokeAssistant`/`invokeModel` in
  `modelClient.js`, and the naming half of `tavilySearch.js` (see "Model code").
- No tests, no CI. (The flow was checked with throwaway scripts and headless
  Chromium screenshots, not a checked-in suite.)
- `About`, `Capstone Paper`, and `Technical Overview` pages are placeholder
  text only.
