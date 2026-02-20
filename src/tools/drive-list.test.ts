import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFilesList = vi.fn();
const mockFilesGet = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    drive: vi.fn(() => ({
      files: {
        list: mockFilesList,
        get: mockFilesGet,
      },
    })),
  },
}));

import { registerDriveListTools } from "./drive-list.js";

function createMockServer() {
  const tools = new Map<string, Function>();
  return {
    tool: (name: string, _desc: string, _schema: any, handler: Function) => {
      tools.set(name, handler);
    },
    call: (name: string, args: any) => tools.get(name)!(args),
  };
}

describe("drive-list tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    registerDriveListTools(server as any, {} as any);
  });

  describe("list_files", () => {
    it("returns mapped files with correct fields", async () => {
      mockFilesList.mockResolvedValue({
        data: {
          files: [
            {
              id: "1",
              name: "My Doc",
              mimeType: "application/vnd.google-apps.document",
              size: "1024",
              modifiedTime: "2026-01-01T00:00:00Z",
              webViewLink: "https://docs.google.com/1",
            },
            {
              id: "2",
              name: "Folder",
              mimeType: "application/vnd.google-apps.folder",
              size: null,
              modifiedTime: "2026-01-02T00:00:00Z",
              webViewLink: "https://drive.google.com/2",
            },
          ],
        },
      });

      const result = await server.call("list_files", {
        folder_id: "root",
        limit: 20,
        type: "all",
      });
      const files = JSON.parse(result.content[0].text);
      expect(files).toHaveLength(2);
      expect(files[0].type).toBe("Google Doc");
      expect(files[0].size).toBe("1.0 KB");
      expect(files[1].type).toBe("folder");
      expect(files[1].size).toBeNull();
    });

    it("applies type filter for folders", async () => {
      mockFilesList.mockResolvedValue({ data: { files: [] } });
      await server.call("list_files", {
        folder_id: "root",
        limit: 10,
        type: "folders",
      });
      const q = mockFilesList.mock.calls[0][0].q;
      expect(q).toContain("mimeType='application/vnd.google-apps.folder'");
    });

    it("handles empty file list", async () => {
      mockFilesList.mockResolvedValue({ data: { files: null } });
      const result = await server.call("list_files", {
        folder_id: "root",
        limit: 20,
        type: "all",
      });
      const files = JSON.parse(result.content[0].text);
      expect(files).toEqual([]);
    });
  });

  describe("get_file_info", () => {
    it("returns file metadata", async () => {
      mockFilesGet.mockResolvedValue({
        data: { id: "abc", name: "test.txt", mimeType: "text/plain" },
      });
      const result = await server.call("get_file_info", { file_id: "abc" });
      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBe("abc");
      expect(data.name).toBe("test.txt");
    });
  });

  describe("formatBytes (via list_files)", () => {
    it.each([
      ["500", "500 B"],
      ["1024", "1.0 KB"],
      ["1048576", "1.0 MB"],
      ["1073741824", "1.0 GB"],
    ])("formats %s as %s", async (size, expected) => {
      mockFilesList.mockResolvedValue({
        data: {
          files: [{ id: "1", name: "f", mimeType: "text/plain", size }],
        },
      });
      const result = await server.call("list_files", {
        folder_id: "root",
        limit: 1,
        type: "all",
      });
      const files = JSON.parse(result.content[0].text);
      expect(files[0].size).toBe(expected);
    });
  });
});
