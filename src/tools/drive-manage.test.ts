import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFilesCreate = vi.fn();
const mockFilesUpdate = vi.fn();
const mockFilesGet = vi.fn();
const mockDocsBatchUpdate = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    drive: vi.fn(() => ({
      files: {
        create: mockFilesCreate,
        update: mockFilesUpdate,
        get: mockFilesGet,
      },
    })),
    docs: vi.fn(() => ({
      documents: { batchUpdate: mockDocsBatchUpdate },
    })),
  },
}));

import { registerDriveManageTools } from "./drive-manage.js";

function createMockServer() {
  const tools = new Map<string, Function>();
  return {
    tool: (name: string, _desc: string, _schema: any, handler: Function) => {
      tools.set(name, handler);
    },
    call: (name: string, args: any) => tools.get(name)!(args),
  };
}

describe("drive-manage tools", () => {
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createMockServer();
    registerDriveManageTools(server as any, {} as any);
  });

  describe("create_folder", () => {
    it("creates folder and returns success message", async () => {
      mockFilesCreate.mockResolvedValue({
        data: { id: "f1", name: "New Folder", webViewLink: "https://link" },
      });
      const result = await server.call("create_folder", { name: "New Folder", parent_id: "root" });
      expect(result.content[0].text).toContain('Folder "New Folder" created');
      expect(result.content[0].text).toContain("f1");
    });
  });

  describe("rename_file", () => {
    it("renames and returns success", async () => {
      mockFilesUpdate.mockResolvedValue({
        data: { id: "r1", name: "Renamed" },
      });
      const result = await server.call("rename_file", { file_id: "r1", new_name: "Renamed" });
      expect(result.content[0].text).toContain('Renamed to "Renamed"');
    });
  });

  describe("move_file", () => {
    it("moves file to new parent", async () => {
      mockFilesGet.mockResolvedValue({
        data: { parents: ["old-parent"], name: "moved.txt" },
      });
      mockFilesUpdate.mockResolvedValue({
        data: { id: "m1", name: "moved.txt", parents: ["new-parent"] },
      });
      const result = await server.call("move_file", {
        file_id: "m1",
        destination_folder_id: "new-parent",
      });
      expect(result.content[0].text).toContain("moved successfully");
      expect(mockFilesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          addParents: "new-parent",
          removeParents: "old-parent",
        }),
      );
    });
  });

  describe("delete_file", () => {
    it("trashes file", async () => {
      mockFilesGet.mockResolvedValue({ data: { name: "trash-me.txt" } });
      mockFilesUpdate.mockResolvedValue({});
      const result = await server.call("delete_file", { file_id: "d1" });
      expect(result.content[0].text).toContain("moved to Trash");
      expect(mockFilesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: { trashed: true },
        }),
      );
    });
  });

  describe("create_document", () => {
    it("creates doc and inserts content", async () => {
      mockFilesCreate.mockResolvedValue({
        data: { id: "doc1", name: "My Doc", webViewLink: "https://doc" },
      });
      mockDocsBatchUpdate.mockResolvedValue({});
      const result = await server.call("create_document", {
        name: "My Doc",
        content: "Hello",
        folder_id: "root",
      });
      expect(result.content[0].text).toContain('Document "My Doc" created');
      expect(mockDocsBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: "doc1",
        }),
      );
    });
  });

  describe("upload_text_file", () => {
    it("uploads text file", async () => {
      mockFilesCreate.mockResolvedValue({
        data: { id: "u1", name: "notes.txt", webViewLink: "https://file" },
      });
      const result = await server.call("upload_text_file", {
        name: "notes.txt",
        content: "some text",
        folder_id: "root",
      });
      expect(result.content[0].text).toContain('File "notes.txt" uploaded');
    });
  });
});
