import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import { google } from "googleapis";
import type { Config } from "./config.js";

// OAuth2Client is re-exported via the googleapis facade; alias for readability.
export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

const SCOPES = ["https://www.googleapis.com/auth/drive"];

export function createOAuth2Client(config: Config): OAuth2Client {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

/**
 * Load cached token and set on client. Returns true if token was loaded.
 */
export function loadCachedToken(client: OAuth2Client, tokenPath: string): boolean {
  try {
    const raw = readFileSync(tokenPath, "utf-8");
    client.setCredentials(JSON.parse(raw) as Parameters<OAuth2Client["setCredentials"]>[0]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save token to disk. Creates directory if needed.
 */
export function saveToken(client: OAuth2Client, tokenPath: string): void {
  mkdirSync(dirname(tokenPath), { recursive: true });
  writeFileSync(tokenPath, JSON.stringify(client.credentials, null, 2));
}

/**
 * Interactive OAuth2 flow for CLI auth command.
 * Prints auth URL, user opens in browser, pastes the redirect URL or code back.
 */
export async function runAuthFlow(config: Config): Promise<void> {
  const client = createOAuth2Client(config);

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  process.stdout.write("\n=== Google Drive MCP - Authentication ===\n\n");
  process.stdout.write("Open this URL in your browser:\n\n");
  process.stdout.write(`${authUrl}\n\n`);
  process.stdout.write("Waiting for Google callback on port 3456...\n");
  process.stdout.write(
    "(Make sure port 3456 is forwarded in VSCode: Ports tab -> Forward 3456)\n\n",
  );

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.end(`<h2>Fehler: ${error}</h2><p>Tab kann geschlossen werden.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }
      if (code) {
        res.end("<h2>Authentifizierung erfolgreich!</h2><p>Tab kann geschlossen werden.</p>");
        server.close();
        resolve(code);
      } else {
        res.end("Warte...");
      }
    });

    server.listen(3456, () => {});
    server.on("error", reject);
    setTimeout(
      () => {
        server.close();
        reject(new Error("Timeout nach 10 Minuten"));
      },
      10 * 60 * 1000,
    );
  });

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  saveToken(client, config.tokenPath);
}

/**
 * Create an authenticated OAuth2 client for use in MCP server.
 * Fails fast if no cached token found (Device Code not possible in stdio mode).
 */
export async function createAuthenticatedClient(config: Config): Promise<OAuth2Client> {
  const client = createOAuth2Client(config);

  if (!loadCachedToken(client, config.tokenPath)) {
    process.stderr.write("\n[gdrive-mcp] Not authenticated. Run first:\n\n  npm run auth\n\n");
    process.exit(1);
  }

  // Auto-refresh token if expired
  client.on("tokens", (tokens: { access_token?: string | null; refresh_token?: string | null }) => {
    if (tokens.refresh_token || tokens.access_token) {
      const current = client.credentials;
      client.setCredentials({ ...current, ...tokens });
      saveToken(client, config.tokenPath);
    }
  });

  return client;
}
