# `@libs/payment`

Backend-internal unified payment domain for Stripe, PayPal, Creem, Dodo, WeChat Pay and Alipay. It creates provider checkouts, verifies callbacks/webhooks and sends trusted results through one idempotent fulfillment service for orders, subscriptions, lifetime access, credit packs and affiliate commissions.

See [`docs/stable/runbooks/payment/providers.md`](../../docs/stable/runbooks/payment/providers.md) for configuration and verification.
