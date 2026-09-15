# ClearCart

A chat-style product research assistant. A user types a product name into a
chat box; the app (eventually) finds that product online, confirms it's the
right one, and gives it a multi-dimensional rating (planet impact, people &
supply chain, quality, value, transparency) with sourced explanations —
similar to how a capstone research paper's rubric would score a product.

The original design is a Figma-style mockup with two frames: an empty chat
state ("Let's look at a product together") and a populated state showing a
user message, a "Found it!" reply card, and a rubric/conclusion writeup. The
sidebar (right-hand side) is persistent across the whole site: logo, nav
links to other pages, and a running list of past chat sessions ("Previous
Carts").

**This is not a git repository.** There's no version control set up yet —
worth doing before this gets much bigger.

## Tech stack

- React 19 + Vite (plain Vite/React template, not Next.js)
- React Router v7 for client-side routing
- Tailwind CSS v4, wired in via `@tailwindcss/vite` (no `tailwind.config.js`
  needed — v4 style)
- `oxlint` for linting (`npm run lint`)
- No backend yet. No test framework set up.

Run locally: `npm install && npm run dev` (Vite dev server, default port
5173).

Node/npm were not preinstalled in the dev sandbox this was built in — if
that's true in a fresh environment too, install via `apt-get install -y
nodejs npm` (needs sudo/interactive auth, so the user usually runs it
themselves) before `npm install` will work.

## File map

```
src/
  App.jsx                 — routes (all under a shared Layout)
  components/
    Layout.jsx             — flex shell: main content (Outlet) + Sidebar
    Sidebar.jsx             — persistent right sidebar: logo, nav, history list
    ChatInput.jsx            — the pill-shaped message input + send button
  hooks/
    useCarts.js              — subscribes a component to the carts localStorage store
  lib/
    carts.js                 — localStorage-backed chat history ("carts") CRUD
  pages/
    Home.jsx                 — the chat page (empty state + running conversation)
    About.jsx, CapstonePaper.jsx, TechnicalOverview.jsx — placeholder content pages
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

## Product lookup — researched, NOT currently implemented

The actual "find the product and rate it" functionality is still a stub:
`Home.jsx`'s assistant reply just echoes back whatever product name the user
typed. This is intentional for now — the surrounding chat/history UX was
built first.

We researched and **decided on an approach, then built and fully reverted a
first implementation** (the user asked to undo it after it was built, to
reconsider/redo later — not because the approach was wrong). The decided
approach, if picked back up:

1. **Search**: Brave Search API (`api.search.brave.com`), query scoped to
   `site:amazon.com`, to find a candidate Amazon product page URL for the
   user's product name. Chosen over Google Custom Search (more setup
   friction) and over paid Amazon-data aggregators (Canopy/Rainforest/
   SerpApi — viable alternatives, but this approach avoids per-request
   scraping-API costs).
2. **Fetch + parse**: server-side fetch of the candidate product page, then
   extract `schema.org` `Product`/`Offer` JSON-LD (`<script
   type="application/ld+json">`) already embedded in the page HTML for SEO —
   the same trick Google Shopping itself relies on. No per-store API needed
   for the data extraction step itself.
3. **Requires a small backend.** The browser can't fetch arbitrary
   cross-origin retailer pages (CORS) or hold the Brave API key safely, so
   this needs a Node/Express server alongside Vite (proxied via Vite's
   `server.proxy` in dev), not just client-side code.
4. **Confirmation UX** (agreed direction): after a search resolves, show a
   card in the chat — image/name/price/rating pulled from the JSON-LD — with
   "Is this the right product?" and Yes/No buttons (not free-text
   yes/no parsing, to stay consistent with the "easy to read/use for older
   users" design goal). Yes/No updates that message's state in place
   (`pending` → `confirmed`/`rejected`) rather than removing it.
5. **Known risk, not yet tested**: Amazon aggressively blocks non-browser
   scrapers (bot detection/CAPTCHA on server-side fetches). This was never
   verified against a real Brave API key or real Amazon responses before the
   revert. If picked back up, test this early — it may force a pivot (e.g.
   randomized headers, a headless-browser fetch, or a different/less
   defended retailer) before the rest of the flow is worth polishing.

When resuming this: a full implementation already existed (server with
`/api/products/search`, `lib/braveSearch.js`, `lib/productLookup.js`
JSON-LD parser with unit-style verification via a standalone script, a
`ProductConfirmCard` component, Vite proxy config, `concurrently`-based dev
script) — it worked in a mocked end-to-end browser test but was reverted
unused. Re-derive it fresh rather than assuming any of the above file names
still apply; this doc is the record of *what was decided*, not what's on
disk.

## Known gaps / next steps

- Product lookup + rating is still a stub (see above).
- No tests, no CI, no git repo.
- `About`, `Capstone Paper`, and `Technical Overview` pages are placeholder
  text only — no real content yet.
- No "start a new chat" affordance beyond navigating back to `/` (e.g. the
  logo link) — works, but isn't an explicit button.
