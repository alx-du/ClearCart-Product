# ClearCart

A React product-research chat interface. The frontend is a static site on GitHub Pages. A small Express server (`server/`) does product lookup with Tavily and calls the model through any OpenAI-compatible chat-completions endpoint, normally the Ethical Tech CoLab [pages-ai-proxy](https://github.com/Ethical-Tech-CoLab/pages-ai-proxy).

```
Browser (GitHub Pages)  ──►  ClearCart server (Express)  ──►  pages-ai-proxy  ──►  cloud model API
                              Tavily key, cache,               provider token,       or a B3IQ GPU
                              prompts, JSON checks             model routing          model
```

## How a search works

1. The opening screen is the ClearCart heading, a tagline, and the input. The text goes to `/api/resolve-product`, which searches with [Tavily](https://tavily.com) and then makes one small model call to turn the results into up to three clean product names, each with a product photo when one is found. The user can also paste a product link: Tavily reads the page and the same model call names the product on it.
2. The user confirms a candidate ("Yes, that's it" / "No, show another"). Confirming adds the product to their cart (a history entry) and starts the initial assessment.
3. Once the assessment is shown, starter prompts appear and the input becomes a follow-up box, answered in plain text.

The prompts live in `server/lib/modelClient.js`; there is nothing to publish to a hosted agent.

## Configure

Copy `.env.example` to `.env` and set:

- `TAVILY_API_KEY` for live lookups.
- `AI_ENDPOINT`: the proxy's `/v1/chat/completions` URL (or a provider's, with `AI_API_KEY`).
- `AI_MODEL`: the model id to use, e.g. `gpt-5-mini`, or a local model id such as `qwen3:14b` if the proxy routes it to a B3IQ GPU. Optionally `AI_NAMING_MODEL` for a smaller model for naming, and `AI_NAMING_REASONING_EFFORT=minimal` for models that accept that parameter.
- `AI_PROXY_ORIGIN`: an origin in the proxy's `ALLOWED_ORIGINS`. The proxy rejects requests with no Origin header (unless it allows `*`), and a server-side request sends none.

Without the model settings, lookups fall back to cleaning page titles (noticeably worse names) and uncached assessments fail. The three demo products below need no keys at all.

### Running the proxy locally

```
git clone https://github.com/Ethical-Tech-CoLab/pages-ai-proxy   # private org repo
cd pages-ai-proxy
AI_TOKEN=<provider key> AI_UPSTREAM=https://api.openai.com/v1/chat/completions \
  ALLOWED_ORIGINS=http://localhost:5173 node local-server.mjs      # → http://localhost:8788
```

Then use `AI_ENDPOINT=http://localhost:8788/v1/chat/completions` and `AI_PROXY_ORIGIN=http://localhost:5173`. The proxy README covers deploying it (B3IQ, Cloudflare Workers) and routing models to a local GPU.

## Deploy

**Frontend (GitHub Pages).** `.github/workflows/deploy-pages.yml` builds and publishes on every push to `main`. One-time setup in the repository settings:

1. Pages → Source: **GitHub Actions**.
2. Actions → Variables: `CLEARCART_API_URL` = the public URL of the ClearCart server (no trailing slash).

**Backend (ClearCart server).** Run `npm ci && npm start` anywhere Node 22 runs, for example on the B3IQ machine next to the proxy, behind the same Cloudflare Tunnel. Set the variables from `.env.example`, plus `CORS_ORIGINS` = the Pages origin (e.g. `https://alx-du.github.io`) so the browser may call it. The server also serves the built frontend itself, so it can host the whole app on its own.

The proxy has no rate limiting and neither does this server, so any model call not answered by the cache costs money on a paid upstream.

## Run locally

Install dependencies with `npm install`, then run `npm run dev`. This starts both the Express API on port 8787 and Vite on its normal development port (Vite forwards `/api` to Express).

## Run locally without any setup (demo mode)

`/api/resolve-product` and `/api/chat` check a small hand-seeded response cache (`server/lib/responseCache.js`) before ever calling Tavily or the model. A cache hit needs no credentials, no `.env`, and never touches the network — so `npm install && npm run dev` works immediately: enter one of **iPhone 15 Pro**, **Nike Air Force 1**, or **Patagonia Better Sweater Fleece**, confirm it, and you get the full assessment. Follow-up questions are not covered (they need a live model).

Anything else falls through to the real Tavily and model calls (and errors, if you haven't configured them). To make a cache miss fail gracefully instead — useful for a demo where you only want to show off the seeded products — set `DEMO_MODE=true`:

```
DEMO_MODE=true npm run dev
```

Note: the seeded cache entries are placeholder content for exercising the UI, not real researched/cited product data.

## Other commands

- `npm run lint` — lint the project
- `npm run build` — create a production frontend build
- `npm run dev:api` — run only the Express API
- `npm run dev:web` — run only Vite
