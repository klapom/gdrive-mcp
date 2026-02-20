import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFilesList = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    drive: vi.fn(() => ({
      files: { list: mockFilesList },
    })),
  },
}));

import { registerDriveSearchTools } from "./drive-search.js";

function createMockServer() {
  const tools = new Map<string, Function>();
  return {
    tool: (name: string, _desc: string, _schema: any, handler: Function) => {
      tools.set(name, handler);
    },
    call: (name: string, args: any) => tools.get(name)!(args),
  };
}

describe("drive-search tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    registerDriveSearchTools(server as any, {} as any);
  });

  it("builds name query", async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } });
    await server.call("search_files", { query: "test", search_in: "name", limit: 10 });
    expect(mockFilesList.mock.calls[0][0].q).toBe(
      "name contains 'test' and trashed=false",
    );
  });

  it("builds content query", async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } });
    await server.call("search_files", { query: "test", search_in: "content", limit: 10 });
    expect(mockFilesList.mock.calls[0][0].q).toBe(
      "fullText contains 'test' and trashed=false",
    );
  });

  it("builds both query", async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } });
    await server.call("search_files", { query: "test", search_in: "both", limit: 10 });
    const q = mockFilesList.mock.calls[0][0].q;
    expect(q).toContain("name contains 'test'");
    expect(q).toContain("fullText contains 'test'");
  });

  it("escapes single quotes in query", async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } });
    await server.call("search_files", { query: "it's", search_in: "name", limit: 10 });
    expect(mockFilesList.mock.calls[0][0].q).toContain("it\\'s");
  });

  it("returns 'no files found' message when empty", async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } });
    const result = await server.call("search_files", { query: "nope", search_in: "name", limit: 10 });
    expect(result.content[0].text).toContain('No files found for: "nope"');
  });

  it("returns mapped file results", async () => {
    mockFilesList.mockResolvedValue({
      data: {
        files: [
          { id: "1", name: "doc.txt", mimeType: "text/plain", modifiedTime: "2026-01-01", webViewLink: "https://x" },
        ],
      },
    });
    const result = await server.call("search_files", { query: "doc", search_in: "name", limit: 10 });
    const files = JSON.parse(result.content[0].text);
    expect(files[0].id).toBe("1");
    expect(files[0].name).toBe("doc.txt");
  });
});
