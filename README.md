# ClearCart

A product research site. Search for a product: if ClearCart has researched it, you get a page rating it on five separate dimensions (planet, people & supply chain, quality, value, transparency), with a source for every fact and the gaps stated plainly. If it hasn't, you see what's known about related records — the brand, its owner, where it makes its other products, country risk lists — and can ask for it to be researched.

No visitor request calls an AI model. The frontend is a static site on GitHub Pages; a small Express server (`server/`) serves the catalogue and runs web lookups with [Tavily](https://tavily.com).

```
Browser (GitHub Pages)  ──►  ClearCart server (Express)  ──►  Tavily (web lookups only,
                              catalogue JSON, lookup ladder,     cached and rate-limited)
                              request queue
```

**The catalogue currently holds demo data only:** a made-up brand (Hartwell, owned by Corvane Group) with two products. The site labels it as demo data.

## How a search works

1. **Catalogue first.** The search box matches the catalogue (product names, aliases, brands). This is free and instant.
2. **Product page.** A researched product shows five dimensions, each with a score (or none), a coverage badge (scored, inferred, claimed, unknown) and its evidence: facts with sources, and "Not public" gaps. Also where it's made (tiers 1–4), who reported it, and a conclusion. There is no overall score.
3. **Related knowledge.** For anything else, "Look up on the web" makes one Tavily search (cached for 7 days) and reads the results with text patterns: brand, material, country of origin, maker. The page then shows facts about the brand, its owner, the brand's other factories (context only) and country risk. Nothing on it is scored, because none of it is about that product. Visitors can add it to the research queue.

## Configure

Copy `.env.example` to `.env`. Everything is optional:

- `TAVILY_API_KEY` enables web lookups. Without it, a lookup uses only the words of the search.
- `TAVILY_DAILY_LIMIT` caps Tavily searches per day (default 200). Each visitor is also limited to 15 per hour; cached lookups don't count.
- `DEMO_MODE=true` never calls Tavily.
- `TRUST_PROXY` (e.g. `1`) when the server runs behind a proxy or tunnel, so per-visitor limits see real addresses.
- `CORS_ORIGINS`: the GitHub Pages origin, so the browser may call the server.

The `AI_*` settings are only for `npm run descriptions:build` (below), never for visitor requests. They point at an OpenAI-compatible endpoint, normally the Ethical Tech CoLab [pages-ai-proxy](https://github.com/Ethical-Tech-CoLab/pages-ai-proxy).

## Product descriptions

The one-line summary for each dimension and the conclusion on a product page are written from the product's facts, not typed by hand. `npm run descriptions:build` asks the model to write any description whose facts have changed since it was last written, checks the result (every sentence must cite the facts it rests on; no "ethical", "best" or similar; no "verified" for unverified evidence), and stores it in `server/data/descriptions.json` with a hash of the facts it came from. When the facts change, the page shows a plain summary built from the facts until the build runs again.

- To use Claude, set `AI_DESCRIPTION_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` (model `claude-opus-5-5` unless `CLAUDE_MODEL` says otherwise). Otherwise it uses the OpenAI-compatible `AI_ENDPOINT`, e.g. a local Ollama model (see `.env.example`).
- `npm run descriptions:build -- --dry-run` lists what's out of date.
- `npm run descriptions:build -- --force` rewrites everything.
- Set `"reviewed": true` on an entry once someone has checked it.

## Catalogue data

`server/data/catalogue.json` holds products, brands and other organizations, factories (sites), each product's supply chain, facts, gaps, curated assessments, sources and contributors. Facts attach to whatever they're about, so a factory's audit is stored once and shows up on every product made there. `server/data/risk-reference.json` is for government risk lists, such as the US Department of Labor's List of Goods Produced by Child Labor or Forced Labor. It is empty until someone loads the real list; see the note in the file.

The server writes its search cache and research-request counts to `server/data/runtime/` (not in git).

## Deploy

**Frontend (GitHub Pages).** `.github/workflows/deploy-pages.yml` builds and publishes on every push to `main`. One-time setup in the repository settings:

1. Pages → Source: **GitHub Actions**.
2. Actions → Variables: `CLEARCART_API_URL` = the public URL of the ClearCart server (no trailing slash).

**Backend (ClearCart server).** Run `npm ci && npm start` anywhere Node 22 runs, for example on the CoLab's B3IQ machine behind a Cloudflare Tunnel. Set the variables above, including `CORS_ORIGINS` = the Pages origin (e.g. `https://alx-du.github.io`). The server also serves the built frontend itself, so it can host the whole app on its own.

## Run locally

`npm install`, then `npm run dev`. This starts the Express API on port 8787 and Vite on its usual port (Vite forwards `/api` to Express). Try searching for "hartwell".

## Other commands

- `npm run descriptions:build` — write product descriptions that are out of date
- `npm run lint` — lint the project
- `npm run build` — create a production frontend build
- `npm run dev:api` — run only the Express API
- `npm run dev:web` — run only Vite
