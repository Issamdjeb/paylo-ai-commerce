# Paylo — PayPal AI Commerce Demo

Paylo is an AI commerce agent prototype for the PayPal AI Hackathon. It grounds shopper answers in a merchant-reviewed catalog, helps buyers compare offers, and prepares a PayPal Sandbox checkout for buyer review. AItools Hubi is the demo merchant.

The repository is an isolated copy of Paylo's buyer page, agent workspace, merchant Studio, and the API routes those pages use. It has no original Git history, production credentials, customer exports, or production analytics exports.

## Surfaces

- `/paypal-ai` — shopper conversation, catalog answers, and PayPal checkout cards.
- `/paylo-agent` — Paylo agent workspace.
- `/paylo-studio` — merchant catalog and operations Studio, including the AG Studio insights view and scheduler.
- `/paylo-demo.html` — standalone storefront embed example.

The project also includes voice interaction, Pay in 4 estimates, order lookup, merchant invoice tools, industry classification, and exit recovery UI. Payment eligibility is decided by PayPal at checkout. Preview and simulation panels are not completed PayPal transactions; only a verified PayPal API result represents a completed payment.

See [the architecture notes](docs/ARCHITECTURE.md) and [the demo walkthrough](docs/DEMO-GUIDE.md) for system boundaries and the recording flow.

## Run locally

Requirements: Node.js 20+ and pnpm 11+.

1. Install dependencies: `pnpm install`.
2. Copy `.env.example` to `artifacts/api-server/.env` and add Sandbox credentials plus an OpenRouter key.
3. Copy `artifacts/aitoolshubi/.env.example` to `artifacts/aitoolshubi/.env.local`. Leave `VITE_API_BASE_URL` blank for the Vite proxy.
4. Start both services with `pnpm dev`.
5. Open `http://localhost:5173/paypal-ai` or `http://localhost:5173/paylo-studio`.

The API listens on port 5000. For a local merchant setup, connect a PayPal Sandbox REST app from Paylo Studio. Sandbox secrets stay on the server and must never be entered into a shopper-facing page or committed to Git.

## PayPal and AI configuration

Required for AI answers: `OPENROUTER_API_KEY` on the API server. `GEMINI_API_KEY` is an optional fallback. The current model route is selected in server code; operators can override it with comma-separated `OPENROUTER_MODELS` and `OPENROUTER_VISION_MODELS` values. Configure only model IDs available to the deployment's OpenRouter account. Stronger models can be added later without changing the shopper-facing integration; no future model is represented as active in this demo.

Required for Sandbox checkout: `PAYPAL_MODE=sandbox`, `PAYPAL_CLIENT_ID`, and `PAYPAL_SECRET_KEY`. For recurring plans, configure the six `PAYPAL_PLAN_*` variables with plan IDs created in the same Sandbox merchant account so checkout keeps working after a service restart. One-time offers do not need a billing plan ID.

For merchant sign-in, configure a separate demo Supabase project with `SUPABASE_URL` and `SUPABASE_ANON_KEY`; add the merchant's email to `ADMIN_EMAILS`. Do not connect the public hackathon build to the production AItools Hubi database. A service-role key is not needed for the buyer demo and must never use a `VITE_` prefix.

## Separate hosted demo

`render.yaml` deploys one isolated Node service that serves both the built app and API from the same new Render hostname. Add the Sandbox PayPal and AI provider values to that new service; values in the existing AItools Hubi Render service are **not automatically shared**. No Live PayPal credentials are needed. The app and API share one origin, so `VITE_API_BASE_URL` can stay blank.

The first judge URL can be the separate Render hostname, for example `https://paylo-hackathon.onrender.com/paypal-ai`. A path under `aitoolshubi.com` requires changing the existing business host's routing; that is intentionally kept out of this deployment. A dedicated subdomain can be added later without changing this repository, after its DNS CNAME is configured.

## Data and limitations

- The included merchant catalog is a sanitized public catalog for the AItools Hubi demo store only.
- Runtime activity is scoped to this deployment. Do not copy account exports, customer lists, invoice files, or Live business data here.
- Render's free filesystem is ephemeral. Store persistent records in a separately configured database or persistent disk before using this as a real merchant service.
- Keep all `.env` files private. Rotate a key if it is accidentally committed.
- The open-source source is provided under the MIT License; see `LICENSE`.
