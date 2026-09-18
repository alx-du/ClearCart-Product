# ClearCart

A React product-research chat interface with a Microsoft Foundry prompt agent. Production uses Azure Static Web Apps with managed Azure Functions in the `api` directory. Express remains available for local development.

## How a search works

1. The opening screen is the ClearCart heading, a tagline, and the input. The text goes to `/api/resolve-product`, which searches with [Tavily](https://tavily.com) and then makes one small model call (the `FOUNDRY_MODEL_DEPLOYMENT` deployment, not the agent) to turn the results into up to three clean product names, each with a product photo when one is found. The user can also paste a product link: Tavily reads the page and the same model call names the product on it.
2. The user confirms a candidate ("Yes, that's it" / "No, show another"). Confirming adds the product to their cart (a history entry) and starts the initial assessment through the Foundry agent.
3. Once the assessment is shown, starter prompts appear and the input becomes a follow-up box, answered by the same agent in plain text.

Set `TAVILY_API_KEY` in `.env` for live lookups (get a key from Tavily). Naming also needs the Foundry settings below; without them the lookup falls back to cleaning page titles, which gives noticeably worse names. The three demo products below need no keys at all.

## Configure Microsoft Foundry

1. Copy `.env.example` to `.env`.
2. Set `FOUNDRY_PROJECT_ENDPOINT` to the endpoint shown for your Foundry project.
3. Set `FOUNDRY_MODEL_DEPLOYMENT` to an existing model deployment name in that project.
4. Set `FOUNDRY_AGENT_NAME` to the name ClearCart should use for its prompt agent.
5. Sign in locally with Azure CLI (`az login`) or the Azure extension in VS Code. The signed-in identity needs the **Foundry User** role on the project.
6. Run `npm run agent:create` once to create a new agent version. Run it again only when changing the model or agent instructions. (The instructions now distinguish assessments from follow-up questions, so re-run it after pulling this change or follow-up answers will still come back as assessment JSON.)

Azure Static Web Apps managed Functions do not support managed identity. Production therefore uses `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` for an app registration assigned the **Foundry Agent Consumer** role on the project. Store these values only in Static Web Apps application settings.

## Deploy to Azure Static Web Apps

Create a Free Static Web App connected to this repository with:

- App location: `/`
- API location: `api`
- Output location: `dist`
- Frontend build command: `npm run build`
- API runtime: Node.js 20

Configure these production application settings:

- `TAVILY_API_KEY`
- `FOUNDRY_PROJECT_ENDPOINT`
- `FOUNDRY_AGENT_NAME`
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`

`FOUNDRY_MODEL_DEPLOYMENT` is needed when running `npm run agent:create` and, because product-name lookup calls the model deployment directly, in production too. That direct call is not made through the agent, so confirm the production app registration is allowed to call the model deployment, not only the agent (this has only been tried with a developer identity).

## Run locally

Install dependencies with `npm install`, then run `npm run dev`. This starts both the Express API on port 8787 and Vite on its normal development port. To emulate the Static Web Apps Functions API locally, copy `api/local.settings.example.json` to `api/local.settings.json`, install Azure Functions Core Tools, and run the Static Web Apps CLI.

## Run locally without any Azure setup (demo mode)

`/api/resolve-product` and `/api/chat` check a small hand-seeded response cache (`server/lib/responseCache.js`) before ever calling Tavily or Foundry. A cache hit needs no credentials, no `.env`, and never touches the network — so `npm install && npm run dev` works immediately: enter one of **iPhone 15 Pro**, **Nike Air Force 1**, or **Patagonia Better Sweater Fleece**, confirm it, and you get the full assessment. Follow-up questions are not covered (they need the live agent).

Anything else falls through to the real Tavily and Foundry calls (and errors, if you haven't configured credentials above). To make a cache miss fail gracefully instead — useful for a demo where you only want to show off the seeded products — set `DEMO_MODE=true`:

```
DEMO_MODE=true npm run dev
```

Note: the seeded cache entries are placeholder content for exercising the UI, not real researched/cited product data.

## Other commands

- `npm run lint` — lint the project
- `npm run build` — create a production frontend build
- `npm run build:api` — install the managed Functions dependencies
- `npm run check:api` — syntax-check the managed Functions entry points
- `npm run dev:api` — run only the Express API
- `npm run dev:web` — run only Vite
