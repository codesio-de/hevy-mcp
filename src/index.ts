import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import {
  type AuthEnv,
  handleAuthServerMetadata,
  handleAuthorize,
  handleProtectedResourceMetadata,
  handleRegister,
  handleToken,
  isValidSession,
} from "./auth.ts";
import { registerTools } from "./tools.ts";

export interface Env extends AuthEnv {
  HEVY_API_KEY: string;
}

function createServer(apiKey: string): McpServer {
  const server = new McpServer({ name: "hevy-mcp", version: "0.2.0" });
  registerTools(server, apiKey);
  return server;
}

async function handleMcp(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;

  if (!token || !(await isValidSession(token, env))) {
    const base = new URL(request.url).origin;
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      },
    });
  }

  const server = createServer(env.HEVY_API_KEY);
  return createMcpHandler(server, { route: "/mcp" })(request, env, ctx);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Validate required secrets up front.
    for (const key of ["OAUTH_CLIENT_ID", "OAUTH_CLIENT_SECRET", "HEVY_API_KEY"] as const) {
      if (!env[key]) return new Response(`Missing env: ${key}`, { status: 500 });
    }

    const { pathname } = new URL(request.url);
    const method = request.method;

    // ── OAuth Discovery ──────────────────────────────────────────
    if (
      method === "GET" &&
      (pathname === "/.well-known/oauth-protected-resource" ||
        pathname === "/.well-known/oauth-protected-resource/mcp")
    ) {
      return handleProtectedResourceMetadata(request);
    }
    if (method === "GET" && pathname === "/.well-known/oauth-authorization-server") {
      return handleAuthServerMetadata(request);
    }

    // ── OAuth Endpoints ──────────────────────────────────────────
    if (method === "POST" && pathname === "/oauth/register") return handleRegister(request, env);
    if (method === "GET" && pathname === "/oauth/authorize") return handleAuthorize(request, env);
    if (method === "POST" && pathname === "/oauth/token") return handleToken(request, env);

    // ── MCP Endpoint ─────────────────────────────────────────────
    if (pathname === "/mcp") return handleMcp(request, env, ctx);

    // ── Health ───────────────────────────────────────────────────
    if (method === "GET" && pathname === "/health") return Response.json({ status: "ok" });

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
