# AGENTS.md

Guidance for AI agents working in this repository. Humans: see [README.md](README.md).

## What this is

An MCP server for the [Hevy](https://www.hevy.com) workout app, running on
Cloudflare Workers. It exposes the [Hevy API](https://api.hevyapp.com/docs/) to
MCP clients (e.g. Claude) as 22 tools, behind an OAuth 2.1 gate.

## Tech stack

- **Runtime:** Cloudflare Workers (not Node — no `fs`, `process`, etc. at runtime)
- **Language:** TypeScript, ESM
- **Validation:** Zod **v4**
- **MCP:** `@modelcontextprotocol/sdk` + `createMcpHandler` from `agents/mcp`
- **State:** Workers KV (binding `OAUTH_KV`) for OAuth codes + session tokens

## Commands

```bash
npm run dev        # wrangler dev (local, simulated KV)
npm run deploy     # wrangler deploy
npm run typecheck  # tsc --noEmit  ← run this before committing
```

There is no test runner configured. After changing tools, verify by running
`npm run dev` and driving the MCP endpoint (OAuth flow → `tools/list` →
`tools/call`); a bad Hevy API key surfaces as `Hevy API 401: InvalidApiKey`,
which still proves the full request path works.

## Project layout

| File | Responsibility |
|------|----------------|
| `src/index.ts` | Worker entry: routing for OAuth + `/mcp` (`createMcpHandler`, fresh `McpServer` per request) |
| `src/auth.ts` | OAuth 2.1 (discovery, authorize, token w/ PKCE); state in `OAUTH_KV` |
| `src/tools.ts` | MCP tool definitions + shared Zod schemas |
| `src/hevy.ts` | Thin Hevy API v1 client (`get`/`post`/`put` helpers) |

## Conventions

- **Check [docs/adr/](docs/adr/) before changing architecture** — the *why*
  behind non-obvious choices lives there. In particular, do not swap the custom
  OAuth for `workers-oauth-provider` without reading
  [ADR 0002](docs/adr/0002-custom-oauth-over-library.md).
- **Reuse the shared Zod schemas** in `tools.ts` (`workoutSchema`,
  `routineCreateSchema`, `routineExerciseSchema`, `baseSetFields`, etc.). Do not
  re-inline duplicated set/exercise shapes.
- Tool handlers wrap responses with the local `json()` helper.
- Keep `hevy.ts` a thin pass-through; request shaping/validation lives in `tools.ts`.
- The Hevy API key is read from `env.HEVY_API_KEY` and used server-side only —
  never expose it to the client or put it in a tool response.

## Domain gotchas (verified against the Hevy OpenAPI spec)

- **Rest times:** `rest_seconds` exists **only on routine exercises**, not on
  workouts. Don't add it to workout schemas.
- **Supersets:** the field is `superset_id` (singular). `supersets_id` is wrong
  and silently ignored by Hevy.
- **`rep_range`** (`{start, end}`) exists only on **routine** sets.
- **`rpe`** is restricted to `6, 7, 7.5, 8, 8.5, 9, 9.5, 10`.
- **`folder_id`** is accepted on routine **create** only, not update.
- **Pagination:** `pageSize` max is 10 (except exercise templates: 100).
- **Body measurement update** (`PUT`) overwrites all fields — omitted fields
  become null.

## Security / secrets

- Secrets (`OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `HEVY_API_KEY`) are set via
  `wrangler secret put` and must **never** be committed.
- `wrangler.jsonc` is committed (needed by Git-connected Workers Builds) and
  holds only the non-secret KV namespace id. Local dev secrets live in
  `.dev.vars` (git-ignored).
- Before committing, confirm no real key/secret/KV-id landed in tracked files.

## Git

- Branch off `main`; never commit secrets.
- Run `npm run typecheck` before committing.
