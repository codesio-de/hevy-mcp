/**
 * OAuth 2.1 for MCP — Claude connects with pre-configured client credentials.
 *
 * Auth codes and session tokens are stored in the OAUTH_KV namespace so they
 * persist across isolates / cold starts.
 *
 * Flow:
 * 1. Operator deploys with OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, HEVY_API_KEY secrets.
 * 2. User adds the MCP in Claude, enters client_id + client_secret (Advanced settings).
 * 3. Claude discovers OAuth via /.well-known endpoints.
 * 4. Claude opens /oauth/authorize → auto-approves, redirects back with a code.
 * 5. Claude exchanges the code at /oauth/token (with PKCE verification).
 * 6. Claude uses the session token as Bearer on /mcp.
 * 7. Server uses HEVY_API_KEY for all Hevy API calls.
 */

export interface AuthEnv {
  OAUTH_KV: KVNamespace;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
}

const CODE_TTL_SECONDS = 5 * 60; // auth codes expire after 5 minutes
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

interface AuthCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function baseUrl(request: Request): string {
  return new URL(request.url).origin;
}

async function parseBody(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return (await request.json()) as Record<string, string>;
  }
  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text));
}

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64url(digest);
}

// ── Discovery ──────────────────────────────────────────────────────

export function handleProtectedResourceMetadata(request: Request): Response {
  const base = baseUrl(request);
  return json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: ["hevy"],
  });
}

export function handleAuthServerMetadata(request: Request): Response {
  const base = baseUrl(request);
  return json({
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

export async function handleRegister(request: Request, env: AuthEnv): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // empty / non-JSON body is fine
  }
  return json(
    {
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
      client_name: body.client_name || "Claude",
      redirect_uris: body.redirect_uris || [],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
    },
    201
  );
}

// ── Authorize: auto-approve, redirect back to Claude ───────────────

export async function handleAuthorize(request: Request, env: AuthEnv): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state");
  const codeChallenge = params.get("code_challenge") || "";

  if (clientId !== env.OAUTH_CLIENT_ID) {
    return new Response("Invalid client", { status: 403 });
  }
  if (!redirectUri) {
    return new Response("Missing redirect_uri", { status: 400 });
  }

  const code = crypto.randomUUID();
  const value: AuthCode = { clientId, redirectUri, codeChallenge };
  await env.OAUTH_KV.put(`code:${code}`, JSON.stringify(value), {
    expirationTtl: CODE_TTL_SECONDS,
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  return Response.redirect(redirectUrl.toString(), 302);
}

// ── Token Exchange (with PKCE) ─────────────────────────────────────

export async function handleToken(request: Request, env: AuthEnv): Promise<Response> {
  const body = await parseBody(request);
  const { grant_type, code, client_id, client_secret, code_verifier, refresh_token } = body;

  if (client_id !== env.OAUTH_CLIENT_ID || client_secret !== env.OAUTH_CLIENT_SECRET) {
    return json({ error: "invalid_client" }, 401);
  }

  if (grant_type === "authorization_code") {
    const raw = await env.OAUTH_KV.get(`code:${code}`);
    if (!raw) {
      return json({ error: "invalid_grant" }, 400);
    }
    const authCode = JSON.parse(raw) as AuthCode;
    if (authCode.clientId !== client_id) {
      return json({ error: "invalid_grant" }, 400);
    }

    // PKCE verification
    if (authCode.codeChallenge) {
      if (!code_verifier) {
        return json({ error: "invalid_grant", error_description: "code_verifier required" }, 400);
      }
      const expected = await sha256Base64url(code_verifier);
      if (expected !== authCode.codeChallenge) {
        return json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
      }
    }

    await env.OAUTH_KV.delete(`code:${code}`);

    const sessionToken = crypto.randomUUID();
    await env.OAUTH_KV.put(`session:${sessionToken}`, "1", { expirationTtl: SESSION_TTL_SECONDS });

    return json({
      access_token: sessionToken,
      token_type: "Bearer",
      expires_in: 86400,
      refresh_token: sessionToken,
    });
  }

  if (grant_type === "refresh_token") {
    if (!refresh_token || !(await env.OAUTH_KV.get(`session:${refresh_token}`))) {
      return json({ error: "invalid_grant" }, 400);
    }
    await env.OAUTH_KV.delete(`session:${refresh_token}`);

    const newSession = crypto.randomUUID();
    await env.OAUTH_KV.put(`session:${newSession}`, "1", { expirationTtl: SESSION_TTL_SECONDS });

    return json({
      access_token: newSession,
      token_type: "Bearer",
      expires_in: 86400,
      refresh_token: newSession,
    });
  }

  return json({ error: "unsupported_grant_type" }, 400);
}

// ── Helpers ────────────────────────────────────────────────────────

export async function isValidSession(sessionToken: string, env: AuthEnv): Promise<boolean> {
  return (await env.OAUTH_KV.get(`session:${sessionToken}`)) !== null;
}
