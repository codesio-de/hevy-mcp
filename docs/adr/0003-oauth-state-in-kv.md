# 3. Store OAuth state in Workers KV

Status: Accepted

## Context

The OAuth flow produces state that must be remembered **across separate HTTP
requests**: authorization codes (written at `/oauth/authorize`, validated later
at `/oauth/token`) and session tokens (issued at `/oauth/token`, checked on each
`/mcp` request).

On Cloudflare Workers each request may run in a fresh isolate, so in-memory
structures (a `Map`/`Set`) are not reliably shared and vanish on cold starts —
they cannot back this state.

## Decision

Store both in a Workers KV namespace (binding `OAUTH_KV`):
`code:<code>` entries with a 5-minute TTL, and `session:<token>` entries with a
30-day TTL. TTLs are enforced via KV `expirationTtl`, so expiry is automatic.

## Consequences

- State survives across isolates and cold starts; expiry needs no cleanup job.
- KV is eventually consistent, which is fine here (codes are single-use and
  short-lived; a session write is read back only on later requests).
- Requires a KV namespace + binding; its id lives in the committed
  `wrangler.jsonc` (an account-scoped identifier, not a secret — committed so the
  Git-connected Workers Build can deploy).
