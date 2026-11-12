# Paylo architecture

Paylo is a buyer-facing commerce assistant paired with a merchant workspace. This hackathon build uses AItools Hubi as its example merchant and PayPal Sandbox for the buyer-approved payment flow.

## Request flow

1. The React app serves the shopper experience at `/paypal-ai`, the agent workspace at `/paylo-agent`, and the merchant workspace at `/paylo-studio`.
2. `paylo.js` can embed the shopper widget in another storefront. It derives its API host from the script URL; the widget never receives a PayPal secret or AI provider key.
3. The Express API crawls a merchant URL and stores the extracted catalog for the demo. The agent uses that catalog as grounding context and calls server-configured OpenRouter model IDs (`OPENROUTER_MODELS` and `OPENROUTER_VISION_MODELS`), with Gemini as an optional fallback. The model list can be upgraded through deployment configuration as stronger models become available; the demo does not claim future models are already running.
4. When a buyer asks to purchase an identified plan, Paylo creates a PayPal Sandbox checkout. The buyer reviews and approves on PayPal; only a verified PayPal response is treated as a completed payment.
5. Merchant-only actions require a verified Supabase session and an email in `ADMIN_EMAILS`. The optional unsigned local session and email-header shortcuts are disabled in production.

## Main components

- **Shopper experience:** catalog questions, plan comparisons, voice input/output, product cards, checkout handoff, and a buyer-side PayPal approval step.
- **Merchant Studio:** website ingestion and review, catalog editing, assistant instructions, embed snippets, invoices, an AG Studio report, and an operations scheduler.
- **Agent API:** catalog-grounded chat, order and invoice flows, PayPal configuration, and merchant actions. Credentials remain on the API server.
- **PayPal:** Sandbox REST credentials are used on the server; the public client ID can be returned to the browser to initialize the PayPal SDK. The buyer approves the order before capture.

## Honest demo boundaries

- AI-extracted catalog content must be reviewed by the merchant; extraction is not independent verification.
- Pay in 4 availability is decided by PayPal and the buyer's account. Any local installment breakdown is an estimate only.
- Analytics show recorded API/session activity. Empty data means no recorded event; it is not a forecast or a verified sales history.
- Dispute, treasury sweep, and negotiation views are prototypes unless an API response explicitly confirms the action. They must not be presented as money movement or a refund.
- The demo deployment is separate from the AItools Hubi production service. It does not use the production host's Render variables or live PayPal credentials.

## Sponsor technology

The repository includes AG Studio components and a scheduler component. Do not describe the project as an AG Grid integration unless the final build includes and demonstrates AG Grid's official grid package as a real part of the merchant dashboard.
