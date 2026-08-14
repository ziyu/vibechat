# AGENTS.md

## Scope

`libs/affiliate` owns Backend-internal referral attribution, signup bonuses, payment commissions, withdrawal reservations and Admin processing.

## Rules

- HTTP callers authenticate independently: user routes bind operations to the session user; Admin processing stays behind `requireAdminAPI`.
- Terminal withdrawal states are immutable. Claim a non-terminal record with a conditional update before refunding, so concurrent requests cannot refund twice.
- Money remains stored as decimal strings; validate parsed amounts before arithmetic.
- Referral attribution, signup bonuses, commission creation and withdrawal requests require deterministic idempotency keys.
- New accounts are not KYC verified; only an Admin may set `kycVerified`, and withdrawals must fail closed until then.
- Keep the configured affiliate currency consistent with all commission-bearing plans.
- Run affiliate/credit unit tests, ownership checks, user/Admin E2E and Backend Node + Workers builds after changes.
