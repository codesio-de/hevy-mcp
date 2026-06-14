# 1. Host on Cloudflare Workers

Status: Accepted

## Context

The server is a small, stateless-by-nature HTTP service (an OAuth gate plus an
MCP endpoint that proxies the Hevy API). It needs to be cheap to run, always
reachable, and require minimal operational upkeep for a single-maintainer
hobby project. The previous iteration ran on fly.io with a container.

## Decision

Run on Cloudflare Workers, configured via `wrangler.jsonc`. Use
`createMcpHandler` from the `agents` SDK to serve the MCP endpoint with a
Workers-native transport (the MCP SDK's Node `StreamableHTTPServerTransport`
relies on Node `req`/`res` and does not run on Workers).

## Consequences

- No servers/containers to manage; scales to zero; generous free tier.
- Constraints of the Workers runtime apply: no Node `fs`/`process` at runtime,
  use Web APIs (e.g. Web Crypto), `nodejs_compat` flag enabled for the SDK.
- Persistent state cannot live in memory (see [ADR 0003](0003-oauth-state-in-kv.md)).
- A fresh `McpServer` is created per request (handler-API requirement).
