import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createAuthenticatedClient } from "./auth.js";
import { registerDriveListTools } from "./tools/drive-list.js";
import { registerDriveSearchTools } from "./tools/drive-search.js";
import { registerDriveReadTools } from "./tools/drive-read.js";
import { registerDriveManageTools } from "./tools/drive-manage.js";

const VERSION = "0.1.0";

const server = new McpServer({
  name: "gdrive-mcp",
  version: VERSION,
});

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[gdrive-mcp] Config error: ${msg}\n`);
    process.exit(1);
  }

  const auth = await createAuthenticatedClient(config);

  registerDriveListTools(server, auth);
  registerDriveSearchTools(server, auth);
  registerDriveReadTools(server, auth);
  registerDriveManageTools(server, auth);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(`[gdrive-mcp] v${VERSION} started.\n`);

  const shutdown = async (signal: string) => {
    process.stderr.write(`[gdrive-mcp] Shutting down (${signal})...\n`);
    await server.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  process.stderr.write(
    `[gdrive-mcp] Fatal: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
