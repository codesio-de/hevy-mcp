/**
 * Simplified OAuth for Claude Desktop access control.
 *
 * Unlike Whoop (which requires user OAuth login), Hevy uses a static API key.
 * The outer OAuth layer remains for Claude Desktop compatibility:
 *
 * 1. Claude discovers OAuth via /.well-known/oauth-authorization-server
 * 2. Claude calls /oauth/authorize with its client_id
 * 3. We immediately generate an auth code (no external login needed)
 * 4. We redirect back to Claude with the code
 * 5. Claude exchanges that code at /oauth/token
 * 6. We return a session token
 * 7. Claude sends session token as Bearer on /mcp requests
 * 8. We use the HEVY_API_KEY env var for all API calls
 */

// In-memory stores
const authCodes = new Set<string>();
const sessions = new Set<string>();

function env(key: string): string {
  return process.env[key]!;
}

// ── OAuth Discovery ─────────────────────────────────────────────────

export function handleProtectedResourceMetadata(_req: any, res: any) {
  const base = env("BASE_URL");
  res.json({
    resource: base,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
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

// ── Dynamic Client Registration ─────────────────────────────────────

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

// ── Authorize: Claude → us → immediately back to Claude ─────────────

export function handleAuthorize(req: any, res: any) {
  const { client_id, redirect_uri, state } = req.query;

  if (client_id !== env("OAUTH_CLIENT_ID")) {
    return res.status(403).send("Invalid client");
  }

  // No external login needed — generate auth code immediately
  const code = crypto.randomUUID();
  authCodes.add(code);

  const redirectUrl = new URL(redirect_uri as string);
  redirectUrl.searchParams.set("code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state as string);
  }

  res.redirect(redirectUrl.toString());
}

// ── Token: Claude exchanges code for session token ──────────────────

export function handleToken(req: any, res: any) {
  const { grant_type, code, client_id, client_secret, refresh_token } = req.body;

  // Verify Claude's credentials
  if (client_id !== env("OAUTH_CLIENT_ID") || client_secret !== env("OAUTH_CLIENT_SECRET")) {
    return res.status(403).json({ error: "invalid_client" });
  }

  if (grant_type === "authorization_code") {
    if (!authCodes.has(code)) {
      return res.status(400).json({ error: "invalid_grant" });
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

// ── Helpers for MCP endpoint ────────────────────────────────────────

export function isValidSession(sessionToken: string): boolean {
  return sessions.has(sessionToken);
}

export function getApiKey(): string {
  return env("HEVY_API_KEY");
}
