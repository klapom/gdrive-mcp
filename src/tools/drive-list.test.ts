import { describe, expect, it } from "vitest";
import { buildDriveListTools } from "./drive-list.js";
import { buildTestContext } from "./test-helpers.js";

type Fn = ReturnType<typeof import("vitest").vi.fn>;

describe("drive-list tools", () => {
  it("registers list_files and get_file_info", () => {
    const ctx = buildTestContext();
    const tools = buildDriveListTools(ctx);
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["list_files", "get_file_info"]),
    );
  });

  describe("list_files", () => {
    it("returns mapped files with correct fields", async () => {
      const ctx = buildTestContext();
      (ctx.drive.files.list as Fn).mockResolvedValue({
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

      const tools = buildDriveListTools(ctx);
      const list_files = tools.find((t) => t.name === "list_files")!;
      const result = await list_files.handler(ctx, {
        folder_id: "root",
        limit: 20,
        type: "all",
      });
      const files = JSON.parse((result.content[0]! as { text: string }).text);
      expect(files).toHaveLength(2);
      expect(files[0].type).toBe("Google Doc");
      expect(files[0].size).toBe("1.0 KB");
      expect(files[1].type).toBe("folder");
      expect(files[1].size).toBeNull();
    });

    it("applies type filter for folders", async () => {
      const ctx = buildTestContext();
      (ctx.drive.files.list as Fn).mockResolvedValue({ data: { files: [] } });
      const tools = buildDriveListTools(ctx);
      const list_files = tools.find((t) => t.name === "list_files")!;
      await list_files.handler(ctx, {
        folder_id: "root",
        limit: 10,
        type: "folders",
      });
      const q = (ctx.drive.files.list as Fn).mock.calls[0][0].q;
      expect(q).toContain("mimeType='application/vnd.google-apps.folder'");
    });

    it("handles empty file list", async () => {
      const ctx = buildTestContext();
      (ctx.drive.files.list as Fn).mockResolvedValue({ data: { files: null } });
      const tools = buildDriveListTools(ctx);
      const list_files = tools.find((t) => t.name === "list_files")!;
      const result = await list_files.handler(ctx, {
        folder_id: "root",
        limit: 20,
        type: "all",
      });
      const files = JSON.parse((result.content[0]! as { text: string }).text);
      expect(files).toEqual([]);
    });
  });

  describe("get_file_info", () => {
    it("returns file metadata", async () => {
      const ctx = buildTestContext();
      (ctx.drive.files.get as Fn).mockResolvedValue({
        data: { id: "abc", name: "test.txt", mimeType: "text/plain" },
      });
      const tools = buildDriveListTools(ctx);
      const get_file_info = tools.find((t) => t.name === "get_file_info")!;
      const result = await get_file_info.handler(ctx, { file_id: "abc" });
      const data = JSON.parse((result.content[0]! as { text: string }).text);
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
      const ctx = buildTestContext();
      (ctx.drive.files.list as Fn).mockResolvedValue({
        data: {
          files: [{ id: "1", name: "f", mimeType: "text/plain", size }],
        },
      });
      const tools = buildDriveListTools(ctx);
      const list_files = tools.find((t) => t.name === "list_files")!;
      const result = await list_files.handler(ctx, {
        folder_id: "root",
        limit: 1,
        type: "all",
      });
      const files = JSON.parse((result.content[0]! as { text: string }).text);
      expect(files[0].size).toBe(expected);
    });
  });
});
