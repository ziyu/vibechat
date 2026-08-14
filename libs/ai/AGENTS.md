# AGENTS.md

## Scope

`libs/ai` is Backend-only provider and billing infrastructure for chat, image and video generation. Browser code consumes `@vibechat/api-contracts` and `@vibechat/product-client`; it must never import this library.

## Rules

- The Backend route validates the allow-listed provider, model, size, duration, URL and request ID before calling a provider.
- Every billable call uses a deterministic request/transaction ID. Duplicate requests must not consume credits twice.
- Chat reserves a conservative maximum before opening the stream and settles from provider usage. Setup, stream or missing-usage failures refund through a deterministic ledger transaction.
- Image and video tasks persist owner, provider state, credit cost and refund state. Status reads verify task ownership.
- Provider failure, timeout or interrupted async setup must refund exactly once; never use a browser polling result as the accounting authority.
- Do not log secrets or complete prompts. Error logs include only the user/request/provider/model context needed for reconciliation.
- Missing provider credentials fail explicitly. Do not add fixture responses to authenticated product routes.
- Keep active model allow-lists in `config/ai.ts`, `config/aiImage.ts` and `config/aiVideo.ts`, with client-safe values exported through `config/public.ts`.

## Verification

Run AI billing/task unit tests, `tests/e2e/specs/account-services-ai.spec.ts`, Backend/Web typechecks and Node/Workers builds. A provider can be marked externally unverified when sandbox credentials are absent, but local input, ownership, idempotency and refund paths may not be skipped.
