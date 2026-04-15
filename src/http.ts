import { createServer } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadConfig } from "./config.js";
import { createAuthenticatedClient } from "./auth.js";
import { registerDriveListTools } from "./tools/drive-list.js";
import { registerDriveSearchTools } from "./tools/drive-search.js";
import { registerDriveReadTools } from "./tools/drive-read.js";
import { registerDriveManageTools } from "./tools/drive-manage.js";

const VERSION = "0.1.0";
const PORT = parseInt(process.env.HTTP_PORT ?? "8202", 10);
const HOST = process.env.HTTP_HOST ?? "0.0.0.0";

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function json(
  res: import("http").ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function main() {
  const config = loadConfig();
  const auth = await createAuthenticatedClient(config);

  const server = new McpServer({ name: "gdrive-mcp", version: VERSION });
  registerDriveListTools(server, auth);
  registerDriveSearchTools(server, auth);
  registerDriveReadTools(server, auth);
  registerDriveManageTools(server, auth);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "gdrive-http-wrapper", version: VERSION });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  const tools = await client.listTools();
  const toolNames = new Set(tools.tools.map((t) => t.name));
  process.stderr.write(
    `[gdrive-http] tools: ${[...toolNames].join(", ")}\n`,
  );

  const http = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "x"}`);
    const method = req.method ?? "GET";

    try {
      if (method === "GET" && url.pathname === "/health") {
        return json(res, 200, {
          ok: true,
          service: "gdrive-mcp-http",
          version: VERSION,
          tools: [...toolNames],
        });
      }

      if (method === "GET" && url.pathname === "/tools") {
        return json(res, 200, { tools: tools.tools });
      }

      if (method === "POST" && url.pathname.startsWith("/tools/")) {
        const name = decodeURIComponent(url.pathname.slice("/tools/".length));
        if (!toolNames.has(name)) {
          return json(res, 404, { error: `unknown tool: ${name}` });
        }
        const raw = await readBody(req);
        let args: Record<string, unknown> = {};
        if (raw.trim().length > 0) {
          try {
            args = JSON.parse(raw);
          } catch (e) {
            return json(res, 400, {
              error: "invalid JSON body",
              detail: e instanceof Error ? e.message : String(e),
            });
          }
        }
        const result = await client.callTool({ name, arguments: args });
        return json(res, 200, result);
      }

      return json(res, 404, { error: "not found" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`[gdrive-http] error: ${msg}\n`);
      return json(res, 500, { error: msg });
    }
  });

  http.listen(PORT, HOST, () => {
    process.stderr.write(
      `[gdrive-http] v${VERSION} listening on http://${HOST}:${PORT}\n`,
    );
  });

  const shutdown = async (signal: string) => {
    process.stderr.write(`[gdrive-http] shutdown (${signal})\n`);
    http.close();
    await server.close();
    await client.close();
    process.exit(0);
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
