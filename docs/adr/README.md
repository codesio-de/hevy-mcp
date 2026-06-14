# Architecture Decision Records

Short records of the non-obvious decisions behind this project — the *why*,
to complement the *what/how* in [AGENTS.md](../../AGENTS.md).

Format: lightweight [MADR](https://adr.github.io/madr/). One file per decision,
numbered, immutable once accepted (supersede rather than edit).

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-host-on-cloudflare-workers.md) | Host on Cloudflare Workers | Accepted |
| [0002](0002-custom-oauth-over-library.md) | Custom OAuth instead of workers-oauth-provider | Accepted |
| [0003](0003-oauth-state-in-kv.md) | Store OAuth state in Workers KV | Accepted |
