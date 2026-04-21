#!/usr/bin/env node
/**
 * Dual-surface HTTP entry for gdrive-mcp:
 *   - REST on LISTEN_PORT (default 32370)
 *   - MCP Streamable-HTTP on MCP_PORT (default 33370, path /mcp)
 *
 * For stdio MCP (Claude Desktop), see ./index.ts.
 *
 * Env (see .env.example and ADR-010):
 *   LISTEN_PORT / MCP_PORT       ports (32370 / 33370 per PORT_REGISTRY)
 *   LISTEN_HOST                  bind address (default 0.0.0.0)
 *   GOOGLE_CLIENT_ID             OAuth2 client id (required)
 *   GOOGLE_CLIENT_SECRET         OAuth2 client secret (required)
 *   GOOGLE_TOKEN_PATH            token cache (default ~/.gdrive-mcp/token.json)
 *   GOOGLE_REDIRECT_URI          default http://localhost:3456/callback
 *   LOG_LEVEL                    pino level (default info)
 */
import { createDualServer, createLogger } from "@klapom/mcp-toolkit-ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "../package.json" with { type: "json" };
import { loadContext } from "./tools/context.js";
import { buildRestHandlers, registerTools } from "./tools/index.js";

const REST_PORT = Number(process.env.LISTEN_PORT ?? 32370);
const MCP_PORT = Number(process.env.MCP_PORT ?? 33370);
const HOST = process.env.LISTEN_HOST ?? "0.0.0.0";

const logger = createLogger(pkg.name);

async function start(): Promise<void> {
  const ctx = await loadContext(logger);
  const { handlers, names } = buildRestHandlers(ctx);

  const buildMcpServer = (): McpServer => {
    const s = new McpServer({ name: pkg.name, version: pkg.version });
    registerTools(s, ctx);
    return s;
  };

  const server = createDualServer({
    name: pkg.name,
    version: pkg.version,
    host: HOST,
    restPort: REST_PORT,
    mcpPort: MCP_PORT,
    toolNames: names,
    restHandlers: handlers,
    buildMcpServer,
    logger,
  });

  logger.info({ toolCount: names.length }, "context loaded");

  await server.start();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "received shutdown signal");
    await server.stop();
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

start().catch((err: unknown) => {
  logger.fatal({ err }, "fatal startup error");
  process.exit(1);
});
