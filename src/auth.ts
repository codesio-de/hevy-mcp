/**
 * OAuth 2.1 for MCP — Claude connects with pre-configured client credentials.
 *
 * Flow:
 * 1. User deploys server with OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, HEVY_API_KEY
 * 2. User adds MCP in Claude, enters client_id + client_secret
 * 3. Claude discovers OAuth via /.well-known endpoints
 * 4. Claude opens browser to /oauth/authorize → auto-approves, redirects back
 * 5. Claude exchanges code at /oauth/token (with PKCE verification)
 * 6. Claude uses session token as Bearer on /mcp
 * 7. Server uses HEVY_API_KEY for all Hevy API calls
 */

import crypto from "node:crypto";

// ── Storage ────────────────────────────────────────────────────────

const authCodes = new Map<string, { clientId: string; redirectUri: string; codeChallenge: string }>();
const sessions = new Set<string>();

function env(key: string): string {
  return process.env[key]!;
}

// ── Discovery ──────────────────────────────────────────────────────

export function handleProtectedResourceMetadata(_req: any, res: any) {
  const base = env("BASE_URL");
  res.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: ["hevy"],
  });
}

export function handleAuthServerMetadata(_req: any, res: any) {
  const base = env("BASE_URL");
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    code_challenge_methods_supported: ["S256"],
  });
}

// ── Dynamic Client Registration ────────────────────────────────────
// Some clients use DCR even when pre-configured credentials exist.
// We return the static credentials so both flows work.

export function handleRegister(req: any, res: any) {
  res.status(201).json({
    client_id: env("OAUTH_CLIENT_ID"),
    client_secret: env("OAUTH_CLIENT_SECRET"),
    client_name: req.body.client_name || "Claude",
    redirect_uris: req.body.redirect_uris || [],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_post",
  });
}

// ── Authorize: auto-approve, redirect back to Claude ───────────────

export function handleAuthorize(req: any, res: any) {
  const { client_id, redirect_uri, state, code_challenge } = req.query;

  if (client_id !== env("OAUTH_CLIENT_ID")) {
    return res.status(403).send("Invalid client");
  }

  const code = crypto.randomUUID();
  authCodes.set(code, {
    clientId: client_id as string,
    redirectUri: redirect_uri as string,
    codeChallenge: (code_challenge as string) || "",
  });

  // Auth codes expire after 5 minutes
  setTimeout(() => authCodes.delete(code), 5 * 60 * 1000);

  const redirectUrl = new URL(redirect_uri as string);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state as string);

  res.redirect(redirectUrl.toString());
}

// ── Token Exchange (with PKCE) ─────────────────────────────────────

export function handleToken(req: any, res: any) {
  const { grant_type, code, client_id, client_secret, code_verifier, refresh_token } = req.body;

  if (client_id !== env("OAUTH_CLIENT_ID") || client_secret !== env("OAUTH_CLIENT_SECRET")) {
    return res.status(401).json({ error: "invalid_client" });
  }

  if (grant_type === "authorization_code") {
    const authCode = authCodes.get(code);
    if (!authCode || authCode.clientId !== client_id) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    // PKCE verification
    if (authCode.codeChallenge) {
      if (!code_verifier) {
        return res.status(400).json({ error: "invalid_grant", error_description: "code_verifier required" });
      }
      const expected = crypto.createHash("sha256").update(code_verifier).digest("base64url");
      if (expected !== authCode.codeChallenge) {
        return res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      }
    }

    authCodes.delete(code);

    const sessionToken = crypto.randomUUID();
    sessions.add(sessionToken);

    return res.json({
      access_token: sessionToken,
      token_type: "Bearer",
      expires_in: 86400,
      refresh_token: sessionToken,
    });
  }

  if (grant_type === "refresh_token") {
    if (!sessions.has(refresh_token)) {
      return res.status(400).json({ error: "invalid_grant" });
    }
    sessions.delete(refresh_token);

    const newSession = crypto.randomUUID();
    sessions.add(newSession);

    return res.json({
      access_token: newSession,
      token_type: "Bearer",
      expires_in: 86400,
      refresh_token: newSession,
    });
  }

  res.status(400).json({ error: "unsupported_grant_type" });
}

// ── Helpers ────────────────────────────────────────────────────────

export function isValidSession(sessionToken: string): boolean {
  return sessions.has(sessionToken);
}

export function getApiKey(): string {
  return env("HEVY_API_KEY");
}
