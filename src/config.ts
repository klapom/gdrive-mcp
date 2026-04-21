import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const ConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  tokenPath: z.string().default(join(homedir(), ".gdrive-mcp", "token.json")),
  redirectUri: z.string().default("http://localhost:3456/callback"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const raw = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    tokenPath: process.env.GOOGLE_TOKEN_PATH,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  };

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `  ${e.path.join(".")}: ${e.message}`).join("\n");
    throw new Error(
      `Missing Google credentials.\n${errors}\nSet GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env`,
    );
  }
  return result.data;
}
