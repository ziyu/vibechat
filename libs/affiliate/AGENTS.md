# AGENTS.md

## Scope

`libs/affiliate` is a Backend-internal Admin operations module. It currently owns only processing existing withdrawal records and refunding a reserved commission balance when an Admin rejects a request.

## Rules

- Every caller must be behind `requireAdminAPI`; this module does not authenticate requests itself.
- Terminal withdrawal states are immutable. Claim a non-terminal record with a conditional update before refunding, so concurrent requests cannot refund twice.
- Money remains stored as decimal strings; validate parsed amounts before arithmetic.
- Referral claim, commission creation, signup bonuses and user withdrawal requests are archived under `legacy/libs/affiliate` and must not be restored without product review, ownership APIs and E2E.
- Run Admin API/E2E and Backend Node + Workers builds after changes.
