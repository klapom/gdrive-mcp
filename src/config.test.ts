import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = undefined;
    process.env.GOOGLE_CLIENT_SECRET = undefined;
    process.env.GOOGLE_TOKEN_PATH = undefined;
    process.env.GOOGLE_REDIRECT_URI = undefined;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("loads valid env vars", () => {
    process.env.GOOGLE_CLIENT_ID = "test-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    const config = loadConfig();
    expect(config.clientId).toBe("test-id");
    expect(config.clientSecret).toBe("test-secret");
  });

  it("uses default tokenPath from homedir", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    const config = loadConfig();
    expect(config.tokenPath).toContain(".gdrive-mcp");
    expect(config.tokenPath).toContain("token.json");
  });

  it("uses custom tokenPath when set", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_TOKEN_PATH = "/custom/path/token.json";
    const config = loadConfig();
    expect(config.tokenPath).toBe("/custom/path/token.json");
  });

  it("uses default redirectUri", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    const config = loadConfig();
    expect(config.redirectUri).toBe("http://localhost:3456/callback");
  });

  it("throws when GOOGLE_CLIENT_ID is missing", () => {
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(() => loadConfig()).toThrow("Missing Google credentials");
  });

  it("throws when GOOGLE_CLIENT_SECRET is missing", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    expect(() => loadConfig()).toThrow("Missing Google credentials");
  });

  it("throws when both are missing", () => {
    expect(() => loadConfig()).toThrow("GOOGLE_CLIENT_ID");
  });
});
