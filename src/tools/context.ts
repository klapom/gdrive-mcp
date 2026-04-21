import type { ToolsContext as BaseContext } from "@klapom/mcp-toolkit-ts";
import type { drive_v3 } from "googleapis";
import { google } from "googleapis";
import type { Logger } from "pino";
import { createAuthenticatedClient } from "../auth.js";
import { loadConfig } from "../config.js";

/**
 * Dependencies shared across gdrive tools.
 *
 * Extends toolkit's ToolsContext with a ready-to-use Drive API client.
 * OAuth2 flow + token-cache handled by createAuthenticatedClient at
 * startup; token auto-refresh by googleapis.
 */
export type ToolsContext = BaseContext & {
  drive: drive_v3.Drive;
  docs: ReturnType<typeof google.docs>;
};

export async function loadContext(logger: Logger): Promise<ToolsContext> {
  const config = loadConfig();
  const auth = await createAuthenticatedClient(config);
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });
  return { logger, drive, docs };
}
