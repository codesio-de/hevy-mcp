# 2. Custom OAuth instead of workers-oauth-provider

Status: Accepted

## Context

The MCP endpoint is gated by OAuth 2.1. Cloudflare offers
`@cloudflare/workers-oauth-provider`, which is the conventional choice and
auto-generates discovery metadata, endpoints, and token storage.

However, this server is **single-tenant**: one operator, one shared Hevy API
key, and access controlled by a **fixed client ID + secret that the user enters
in the MCP client** (Claude's "Advanced settings"). This is OAuth's confidential
client model with pre-registered credentials.

`workers-oauth-provider` is built around **Dynamic Client Registration**:
`createClient()` always generates random credentials (you cannot supply your
own), and the flow centers on clients registering themselves. Reproducing the
"fixed credentials the user types in" model would mean a seeding step, captured
generated credentials, and re-pairing the client — friction for no benefit here.

## Decision

Implement the small OAuth surface directly in `src/auth.ts`: discovery
(RFC 8414 / RFC 9728), `/oauth/authorize` (auto-approve for the configured
client), and `/oauth/token` (authorization code + refresh, with PKCE S256).
Client credentials are plain Worker secrets (`OAUTH_CLIENT_ID`,
`OAUTH_CLIENT_SECRET`).

## Consequences

- The user keeps stable, self-chosen credentials; no registration/seeding step.
- ~150 lines of OAuth code to own (acceptable; the surface is small and stable).
- Discovery JSON is hand-written and must match the RFC field names exactly.
- **Do not "modernize" this to `workers-oauth-provider` without first restoring
  the fixed-credential model** — that is the whole point of this decision.
