import { runAuthFlow } from "./auth.js";
/**
 * CLI entry point for OAuth2 authentication.
 * Run: npm run auth
 */
import { loadConfig } from "./config.js";

try {
  const config = loadConfig();
  await runAuthFlow(config);
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[gdrive-mcp] Auth failed: ${msg}\n`);
  process.exit(1);
}
