import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z, ZodRawShape } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { createAuthenticatedClient } from "./auth.js";
import { registerDriveListTools } from "./tools/drive-list.js";
import { registerDriveSearchTools } from "./tools/drive-search.js";
import { registerDriveReadTools } from "./tools/drive-read.js";
import { registerDriveManageTools } from "./tools/drive-manage.js";

const VERSION = "0.2.0";
const REST_PORT = parseInt(process.env.LISTEN_PORT ?? process.env.HTTP_PORT ?? "32370", 10);
const MCP_PORT = parseInt(process.env.MCP_PORT ?? "33370", 10);
const HOST = process.env.LISTEN_HOST ?? process.env.HTTP_HOST ?? "0.0.0.0";

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

interface RegisteredTool {
  name: string;
  description: string;
  shape: ZodRawShape;
  schema: z.ZodObject<ZodRawShape>;
  handler: ToolHandler;
}

const tools = new Map<string, RegisteredTool>();

const registryServer = {
  tool(name: string, description: string, shape: ZodRawShape, handler: ToolHandler) {
    tools.set(name, { name, description, shape, schema: z.object(shape), handler });
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          resolve(parsed as Record<string, unknown>);
        } else {
          reject(new Error("JSON body must be an object"));
        }
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function main() {
  const config = loadConfig();
  const auth = await createAuthenticatedClient(config);

  registerDriveListTools(registryServer, auth);
  registerDriveSearchTools(registryServer, auth);
  registerDriveReadTools(registryServer, auth);
  registerDriveManageTools(registryServer, auth);

  process.stderr.write(
    `[gdrive-http] tools: ${[...tools.keys()].join(", ")}\n`,
  );

  // ---- REST surface ----
  const restServer = createServer(async (req, res) => {
    const rawUrl = req.url ?? "/";
    const url = rawUrl.split("?")[0];
    const method = req.method ?? "GET";

    if (method === "GET" && (url === "/" || url === "/health")) {
      return sendJson(res, 200, {
        ok: true,
        service: "gdrive-mcp-http",
        version: VERSION,
        tools: [...tools.keys()],
        mcpEndpoint: `http://${HOST}:${MCP_PORT}/mcp`,
      });
    }
    if (method === "GET" && url === "/tools") {
      return sendJson(res, 200, {
        tools: Array.from(tools.values()).map((t) => ({ name: t.name, description: t.description })),
      });
    }
    if (method === "POST" && url.startsWith("/tools/")) {
      const name = decodeURIComponent(url.slice("/tools/".length));
      const tool = tools.get(name);
      if (!tool) return sendJson(res, 404, { ok: false, error: `unknown tool: ${name}` });
      let body: Record<string, unknown>;
      try { body = await readBody(req); }
      catch (e) { return sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }); }
      const parsed = tool.schema.safeParse(body);
      if (!parsed.success) {
        return sendJson(res, 400, { ok: false, error: "validation failed", issues: parsed.error.errors });
      }
      try {
        const result = await tool.handler(parsed.data);
        const text = result.content?.map((c) => c.text).join("\n") ?? "";
        let data: unknown = text;
        try { data = JSON.parse(text); } catch { /* leave as text */ }
        return sendJson(res, result.isError ? 500 : 200, { ok: !result.isError, result: data, text });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    sendJson(res, 404, { error: "not found" });
  });

  // ---- MCP Streamable-HTTP surface ----
  function buildMcpServer(): McpServer {
    const s = new McpServer({ name: "gdrive-mcp", version: VERSION });
    for (const t of tools.values()) {
      s.tool(t.name, t.description, t.shape, ((args: unknown) => t.handler(args as Record<string, unknown>)) as never);
    }
    return s;
  }

  const mcpSessions = new Map<string, StreamableHTTPServerTransport>();

  const mcpHttpServer = createServer(async (req, res) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0];
    if (path !== "/mcp" && path !== "/") {
      return sendJson(res, 404, { ok: false, error: "Use /mcp for MCP Streamable-HTTP" });
    }
    try {
      const sid = (req.headers["mcp-session-id"] ?? req.headers["x-mcp-session-id"]) as string | undefined;
      let transport = sid ? mcpSessions.get(sid) : undefined;
      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSid) => { mcpSessions.set(newSid, transport!); },
        });
        transport.onclose = () => {
          if (transport!.sessionId) mcpSessions.delete(transport!.sessionId);
        };
        const srv = buildMcpServer();
        await srv.connect(transport);
      }
      await transport.handleRequest(req, res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[gdrive-http] MCP error: ${msg}\n`);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: msg });
    }
  });

  restServer.listen(REST_PORT, HOST, () => {
    process.stderr.write(`[gdrive-http] REST v${VERSION} on ${HOST}:${REST_PORT} (${tools.size} tools)\n`);
  });
  mcpHttpServer.listen(MCP_PORT, HOST, () => {
    process.stderr.write(`[gdrive-http] MCP  v${VERSION} on ${HOST}:${MCP_PORT}/mcp\n`);
  });

  const shutdown = (sig: string) => {
    process.stderr.write(`[gdrive-http] shutdown (${sig})\n`);
    restServer.close();
    mcpHttpServer.close();
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((e) => {
  process.stderr.write(
    `[gdrive-http] fatal: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`,
  );
  process.exit(1);
});
