# Paylo demo walkthrough

This is a run-of-show, not a word-for-word script. Keep the recording below three minutes and use a clean browser profile with PayPal Sandbox buyer credentials ready.

## Recommended sequence

1. **Set the problem (15–20 seconds).** Show the storefront and explain that buyers often need help understanding plans before checkout, while merchants need a way to connect product knowledge to payment.
2. **Show setup (20–30 seconds).** Open Paylo Studio, enter the demo merchant URL, analyze it, then review the extracted plans and correct any content before publishing the assistant knowledge.
3. **Show the shopper flow (35–45 seconds).** Open the embedded demo storefront. Ask a concrete catalog question, then name one plan. Show Paylo identifying the exact offer and preparing the PayPal Sandbox checkout.
4. **Show buyer approval (25–35 seconds).** Continue to PayPal Sandbox, review the amount and merchant, approve as the sandbox buyer, then return to show the confirmed result. Do not use a Live account or card.
5. **Show merchant follow-through (20–30 seconds).** Return to Studio and show only data or invoices returned by the API. Clearly identify any prototype panel as a preview.
6. **Close (10–15 seconds).** State who Paylo helps and how a merchant can install the widget. Keep the screen on the working product, not slides.

## Recording notes

- Prefer your own camera for a short opening or closing and narrate the screen recording in your natural English. Clear product actions matter more than polished accent or fast speech.
- Record at 1080p, zoom the browser to about 90%, hide unrelated tabs and notifications, and keep the cursor still while speaking.
- Use the isolated Paylo deployment URL once available. Localhost is acceptable for development, but a hosted URL makes setup and judging easier. Do not expose credentials, email inboxes, business dashboards, or Devpost edit controls in the recording.
- Prepare a Sandbox buyer account and test the exact path immediately before recording. Keep one backup take with the buyer already signed in.
- Do not claim Live payments, seller payouts, refunds, balances, verified discounts, or Pay in 4 approval unless the shown PayPal API response confirms it.

## Sandbox setup for the demo

Set the following on the isolated API service only:

- `PAYPAL_MODE=sandbox`
- `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET_KEY` from a PayPal Sandbox REST app
- `OPENROUTER_API_KEY` for agent responses
- `ADMIN_EMAILS` for the merchant account used to access protected Studio actions

For protected merchant screens, use a separate demo Supabase project and its public URL/anon key. Avoid connecting the hackathon deployment to the production AItools Hubi database. Never put a PayPal secret, OpenRouter key, or Supabase service-role key in a `VITE_` variable or browser form.
