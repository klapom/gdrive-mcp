import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFilesGet = vi.fn();
const mockFilesExport = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    drive: vi.fn(() => ({
      files: {
        get: mockFilesGet,
        export: mockFilesExport,
      },
    })),
  },
}));

import { registerDriveReadTools } from "./drive-read.js";

function createMockServer() {
  const tools = new Map<string, Function>();
  return {
    tool: (name: string, _desc: string, _schema: any, handler: Function) => {
      tools.set(name, handler);
    },
    call: (name: string, args: any) => tools.get(name)!(args),
  };
}

describe("drive-read tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    registerDriveReadTools(server as any, {} as any);
  });

  it("exports Google Docs as text/plain", async () => {
    mockFilesGet.mockResolvedValue({
      data: { id: "1", name: "Doc", mimeType: "application/vnd.google-apps.document" },
    });
    mockFilesExport.mockResolvedValue({ data: "Hello world" });

    const result = await server.call("read_file", { file_id: "1", max_chars: 10000 });
    expect(result.content[0].text).toContain("Hello world");
    expect(result.content[0].text).toContain("File: Doc");
    expect(mockFilesExport).toHaveBeenCalledWith(
      { fileId: "1", mimeType: "text/plain" },
      { responseType: "text" },
    );
  });

  it("exports Google Sheets as CSV", async () => {
    mockFilesGet.mockResolvedValue({
      data: { id: "2", name: "Sheet", mimeType: "application/vnd.google-apps.spreadsheet" },
    });
    mockFilesExport.mockResolvedValue({ data: "a,b\n1,2" });

    const result = await server.call("read_file", { file_id: "2", max_chars: 10000 });
    expect(result.content[0].text).toContain("a,b");
  });

  it("reads regular text files via download", async () => {
    // First call: metadata, second call: content download
    mockFilesGet
      .mockResolvedValueOnce({
        data: { id: "3", name: "notes.txt", mimeType: "text/plain" },
      })
      .mockResolvedValueOnce({ data: "file content here" });

    const result = await server.call("read_file", { file_id: "3", max_chars: 10000 });
    expect(result.content[0].text).toContain("file content here");
  });

  it("returns error for binary files", async () => {
    mockFilesGet.mockResolvedValue({
      data: { id: "4", name: "photo.jpg", mimeType: "image/jpeg" },
    });

    const result = await server.call("read_file", { file_id: "4", max_chars: 10000 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("binary file");
  });

  it("returns error for PDF files", async () => {
    mockFilesGet.mockResolvedValue({
      data: { id: "5", name: "report.pdf", mimeType: "application/pdf" },
    });

    const result = await server.call("read_file", { file_id: "5", max_chars: 10000 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("binary file");
  });

  it("truncates long content", async () => {
    mockFilesGet.mockResolvedValue({
      data: { id: "6", name: "Doc", mimeType: "application/vnd.google-apps.document" },
    });
    mockFilesExport.mockResolvedValue({ data: "x".repeat(200) });

    const result = await server.call("read_file", { file_id: "6", max_chars: 100 });
    expect(result.content[0].text).toContain("[Truncated to 100 chars]");
  });
});
