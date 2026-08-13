# AGENTS.md

## Scope

`libs/payment` is the Backend-only adapter and fulfillment domain for Stripe, PayPal, Creem, Dodo, WeChat Pay and Alipay. Browser code uses API contracts/client only.

## Rules

- Checkout amount, currency, duration and credits come from the server-side purchasable plan. Never trust client-supplied monetary values.
- `POST /api/payment/initiate` creates one order per request ID. A failed checkout is terminal and a retry needs a new request ID.
- Webhook/return handlers verify provider signatures or server-side provider state before fulfillment. Browser success pages are UX only.
- Route every verified payment through `fulfillVerifiedPayment`; it validates order/provider/amount/currency and atomically claims fulfillment.
- Subscription, lifetime and credit-plan fulfillment must be idempotent. Credit purchase and affiliate commission transaction IDs derive from the order ID.
- Preserve raw request bytes wherever provider signature verification requires them. Do not log secrets, certificates, full webhook payloads or payer personal data.
- Adding a provider requires config, plan schema, adapter, route, env example, unit tests and sandbox verification notes.

## Verification

Run payment/credit/affiliate unit tests, permission tests, `tests/e2e/specs/account-services-ai.spec.ts`, Backend/Web typechecks and Node/Workers builds. Each external provider still requires its own test/sandbox checkout and webhook before production enablement.
