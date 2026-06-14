# Hevy MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the
[Hevy](https://www.hevy.com) workout-tracking app, running on
[Cloudflare Workers](https://workers.cloudflare.com). It connects Claude (or any
MCP client) to your Hevy fitness data — workouts, routines, exercise templates,
exercise history and body measurements — through the official
[Hevy API](https://api.hevyapp.com/docs/).

The server is **remote and OAuth-protected**: you deploy it once to your own
Cloudflare account, and connect to it as a custom connector. Your Hevy API key
stays a server-side secret and is never exposed to the client.

## Features

- **Full Hevy API coverage** — 22 tools spanning workouts, routines, exercise
  templates, routine folders, exercise history and body measurements.
- **Runs on Cloudflare Workers** — serverless, scales to zero, no servers to
  manage. State for the OAuth flow lives in a Workers KV namespace.
- **OAuth 2.1 with PKCE** — access is gated by a client ID/secret you choose;
  the Hevy API key is kept server-side only.
- **Typed & validated** — written in TypeScript with [Zod](https://zod.dev)
  schemas for every tool input.

## Tools

| Tool | Description |
|------|-------------|
| `hevy_get_user_info` | User profile |
| `hevy_get_workouts` | Paginated workout list |
| `hevy_get_workout` | Single workout by ID |
| `hevy_get_workout_count` | Total workout count |
| `hevy_get_workout_events` | Update/delete events since a date |
| `hevy_create_workout` | Create a new workout |
| `hevy_update_workout` | Update an existing workout |
| `hevy_get_routines` | Paginated routine list |
| `hevy_get_routine` | Single routine by ID |
| `hevy_create_routine` | Create a routine (supports `rest_seconds`, `rep_range`, supersets) |
| `hevy_update_routine` | Update an existing routine |
| `hevy_get_exercise_templates` | Paginated exercise template list |
| `hevy_get_exercise_template` | Single exercise template by ID |
| `hevy_create_exercise_template` | Create a custom exercise |
| `hevy_get_routine_folders` | Paginated folder list |
| `hevy_get_routine_folder` | Single folder by ID |
| `hevy_create_routine_folder` | Create a new folder |
| `hevy_get_exercise_history` | Exercise history for a template |
| `hevy_get_body_measurements` | Paginated body measurement list |
| `hevy_get_body_measurement` | Single body measurement by date |
| `hevy_create_body_measurement` | Create a body measurement entry |
| `hevy_update_body_measurement` | Update a body measurement entry |

> **Note on rest times:** The Hevy API only supports rest/pause times
> (`rest_seconds`, per exercise) on **routines**, not on logged workouts.

## Architecture

```
Claude  ──OAuth──▶  Cloudflare Worker  ──api-key──▶  Hevy API
                      │
                      └─ Workers KV (OAuth codes + session tokens)
```

- `src/index.ts` — Worker entry point: routes OAuth + MCP requests. The `/mcp`
  endpoint is served via `createMcpHandler` from the
  [`agents`](https://www.npmjs.com/package/agents) SDK (a fresh MCP server
  instance per request).
- `src/auth.ts` — minimal OAuth 2.1 implementation (discovery, authorize, token
  with PKCE). Auth codes and session tokens are stored in Workers KV.
- `src/tools.ts` — MCP tool definitions with Zod input schemas.
- `src/hevy.ts` — thin Hevy API v1 client.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com) (the free plan is enough).
- A Hevy API key from [hevy.com/settings?developer](https://hevy.com/settings?developer)
  (requires Hevy Pro).
- Node.js 20+.

## Setup

```bash
git clone https://github.com/codesio-de/hevy-mcp.git
cd hevy-mcp
npm install
npx wrangler login

# Create the KV namespace for OAuth state, then put the returned id into wrangler.jsonc
npx wrangler kv namespace create OAUTH_KV

# Set the secrets (stored encrypted in your Worker, never in the repo)
npx wrangler secret put OAUTH_CLIENT_ID      # any random string you choose
npx wrangler secret put OAUTH_CLIENT_SECRET  # any random string you choose
npx wrangler secret put HEVY_API_KEY         # from Hevy developer settings

npm run deploy
```

`OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` are values **you choose** — they act
as the access password for your server. The public URL (e.g.
`https://hevy-mcp.<your-subdomain>.workers.dev`) is derived automatically from
the request, so no `BASE_URL` configuration is needed.

### Continuous deployment (optional)

You can connect this repo to your Worker in the Cloudflare dashboard
(**Workers Builds**) so every push to `main` deploys automatically. Secrets set
via `wrangler secret put` persist across builds; the committed `wrangler.jsonc`
provides the build with the Worker name, entry point and KV binding.

## Connect Claude

In Claude, go to **Settings → Connectors → Add custom connector** and use the
**Advanced settings** for the OAuth fields:

| Field | Value |
|-------|-------|
| Name | Hevy |
| Remote MCP server URL | `https://hevy-mcp.<your-subdomain>.workers.dev/mcp` |
| OAuth Client ID | Same value as your `OAUTH_CLIENT_ID` secret |
| OAuth Client Secret | Same value as your `OAUTH_CLIENT_SECRET` secret |

On first connect, Claude completes the OAuth flow automatically and the 22 tools
become available.

## Configuration

| Secret / binding | Description |
|------------------|-------------|
| `OAUTH_CLIENT_ID` | Access control — a value you choose |
| `OAUTH_CLIENT_SECRET` | Access control — a value you choose |
| `HEVY_API_KEY` | From Hevy developer settings (server-side only) |
| `OAUTH_KV` | KV namespace binding for OAuth state |

Secrets are set with `wrangler secret put` and are **never** stored in the
repository. The KV namespace id committed in `wrangler.jsonc` is an
account-scoped identifier, not a secret — if you fork the repo, replace it with
your own.

## Local Development

```bash
cp .dev.vars.example .dev.vars   # then fill in your values
npm run dev
```

`wrangler dev` simulates the KV namespace locally, so no remote KV is required
for local testing. `.dev.vars` is git-ignored and never committed.

## Security

- The Hevy API key lives only as a Cloudflare secret; it is never sent to the
  MCP client.
- All endpoints except `/health` and OAuth discovery require a valid bearer
  token; the token exchange is protected by PKCE and your client secret.
- Local secrets (`.dev.vars`), the local KV simulation (`.wrangler/`) and editor
  tooling (`.claude/`) are git-ignored. `wrangler.jsonc` is committed but contains
  no secrets — only the (non-secret) KV namespace id.

## License

MIT — see [LICENSE](LICENSE).
