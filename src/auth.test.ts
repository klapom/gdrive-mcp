import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOAuth2Client, loadCachedToken, saveToken } from "./auth.js";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
        credentials: {},
      })),
    },
  },
}));

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createOAuth2Client", () => {
    it("creates OAuth2 client with config", () => {
      const client = createOAuth2Client({
        clientId: "cid",
        clientSecret: "csec",
        tokenPath: "/tmp/token.json",
        redirectUri: "http://localhost:3456/callback",
      });
      expect(client).toBeDefined();
      expect(client.setCredentials).toBeDefined();
    });
  });

  describe("loadCachedToken", () => {
    it("returns false when file does not exist", () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("ENOENT");
      });
      const client = { setCredentials: vi.fn() } as any;
      expect(loadCachedToken(client, "/nonexistent")).toBe(false);
      expect(client.setCredentials).not.toHaveBeenCalled();
    });

    it("returns true and sets credentials when file exists", () => {
      const tokens = { access_token: "abc", refresh_token: "def" };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(tokens));
      const client = { setCredentials: vi.fn() } as any;
      expect(loadCachedToken(client, "/valid/token.json")).toBe(true);
      expect(client.setCredentials).toHaveBeenCalledWith(tokens);
    });

    it("returns false on invalid JSON", () => {
      vi.mocked(readFileSync).mockReturnValue("not json");
      const client = { setCredentials: vi.fn() } as any;
      expect(loadCachedToken(client, "/bad.json")).toBe(false);
    });
  });

  describe("saveToken", () => {
    it("creates directory and writes file", () => {
      const creds = { access_token: "tok" };
      const client = { credentials: creds } as any;
      saveToken(client, "/some/dir/token.json");
      expect(mkdirSync).toHaveBeenCalledWith("/some/dir", { recursive: true });
      expect(writeFileSync).toHaveBeenCalledWith(
        "/some/dir/token.json",
        JSON.stringify(creds, null, 2),
      );
    });
  });
});
