import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import {
  getApiKey,
  handleAuthServerMetadata,
  handleAuthorize,
  handleProtectedResourceMetadata,
  handleRegister,
  handleToken,
  isValidSession,
} from "./auth.ts";
import { registerTools } from "./tools.ts";

// ── Validate env ────────────────────────────────────────────────────

for (const key of ["OAUTH_CLIENT_ID", "OAUTH_CLIENT_SECRET", "HEVY_API_KEY", "BASE_URL"]) {
  if (!process.env[key]) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
}

// ── Express App ─────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── OAuth Discovery ─────────────────────────────────────────────────

app.get("/.well-known/oauth-protected-resource", handleProtectedResourceMetadata);
app.get("/.well-known/oauth-authorization-server", handleAuthServerMetadata);

// ── OAuth Endpoints ─────────────────────────────────────────────────

app.post("/oauth/register", handleRegister);
app.get("/oauth/authorize", handleAuthorize);
app.post("/oauth/token", handleToken);

// ── MCP Endpoint ────────────────────────────────────────────────────

function createServer(apiKey: string): McpServer {
  const server = new McpServer({
    name: "hevy-mcp",
    version: "0.1.0",
  });

  registerTools(server, apiKey);

  return server;
}

app.post("/mcp", async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const sessionToken = auth?.slice(7);

  if (!auth?.startsWith("Bearer ") || !sessionToken || !isValidSession(sessionToken)) {
    res.status(401)
      .set("WWW-Authenticate", `Bearer resource_metadata="${process.env.BASE_URL}/.well-known/oauth-protected-resource"`)
      .json({ error: "unauthorized" });
    return;
  }

  const apiKey = getApiKey();
  const server = createServer(apiKey);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res as any, req.body);
});

// ── Health ──────────────────────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Start ───────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || "3000");
app.listen(port, () => {
  console.log(`Hevy MCP running on port ${port}`);
});
