import { describe, expect, it } from "vitest";
import { buildDriveManageTools } from "./drive-manage.js";
import { buildTestContext } from "./test-helpers.js";

type Fn = ReturnType<typeof import("vitest").vi.fn>;

describe("drive-manage tools", () => {
  it("registers all manage tools", () => {
    const ctx = buildTestContext();
    const tools = buildDriveManageTools(ctx);
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        "create_folder",
        "rename_file",
        "move_file",
        "delete_file",
        "create_document",
        "upload_text_file",
      ]),
    );
  });

  describe("create_folder", () => {
    it("creates folder and returns success message", async () => {
      const ctx = buildTestContext();
      (ctx.drive.files.create as Fn).mockResolvedValue({
        data: { id: "f1", name: "New Folder", webViewLink: "https://link" },
      });
      const tool = buildDriveManageTools(ctx).find((t) => t.name === "create_folder")!;
      const result = await tool.handler(ctx, { name: "New Folder", parent_id: "root" });
      expect((result.content[0]! as { text: string }).text).toContain(
        'Folder "New Folder" created',
      );
      expect((result.content[0]! as { text: string }).text).toContain("f1");
    });
  });

  describe("rename_file", () => {
    it("renames and returns success", async () => {
      const ctx = buildTestContext();
      (ctx.drive.files.update as Fn).mockResolvedValue({
        data: { id: "r1", name: "Renamed" },
      });
      const tool = buildDriveManageTools(ctx).find((t) => t.name === "rename_file")!;
      const result = await tool.handler(ctx, { file_id: "r1", new_name: "Renamed" });
      expect((result.content[0]! as { text: string }).text).toContain('Renamed to "Renamed"');
    });
  });

  describe("move_file", () => {
    it("moves file to new parent", async () => {
      const ctx = buildTestContext();
      (ctx.drive.files.get as Fn).mockResolvedValue({
        data: { parents: ["old-parent"], name: "moved.txt" },
      });
      (ctx.drive.files.update as Fn).mockResolvedValue({
        data: { id: "m1", name: "moved.txt", parents: ["new-parent"] },
      });
      const tool = buildDriveManageTools(ctx).find((t) => t.name === "move_file")!;
      const result = await tool.handler(ctx, {
        file_id: "m1",
        destination_folder_id: "new-parent",
      });
      expect((result.content[0]! as { text: string }).text).toContain("moved successfully");
      expect(ctx.drive.files.update as Fn).toHaveBeenCalledWith(
        expect.objectContaining({
          addParents: "new-parent",
          removeParents: "old-parent",
        }),
      );
    });
  });

  describe("delete_file", () => {
    it("trashes file", async () => {
      const ctx = buildTestContext();
      (ctx.drive.files.get as Fn).mockResolvedValue({ data: { name: "trash-me.txt" } });
      (ctx.drive.files.update as Fn).mockResolvedValue({});
      const tool = buildDriveManageTools(ctx).find((t) => t.name === "delete_file")!;
      const result = await tool.handler(ctx, { file_id: "d1" });
      expect((result.content[0]! as { text: string }).text).toContain("moved to Trash");
      expect(ctx.drive.files.update as Fn).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: { trashed: true },
        }),
      );
    });
  });

  describe("create_document", () => {
    it("creates doc and inserts content", async () => {
      const ctx = buildTestContext();
      (ctx.drive.files.create as Fn).mockResolvedValue({
        data: { id: "doc1", name: "My Doc", webViewLink: "https://doc" },
      });
      (ctx.docs.documents.batchUpdate as Fn).mockResolvedValue({});
      const tool = buildDriveManageTools(ctx).find((t) => t.name === "create_document")!;
      const result = await tool.handler(ctx, {
        name: "My Doc",
        content: "Hello",
        folder_id: "root",
      });
      expect((result.content[0]! as { text: string }).text).toContain('Document "My Doc" created');
      expect(ctx.docs.documents.batchUpdate as Fn).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: "doc1",
        }),
      );
    });
  });

  describe("upload_text_file", () => {
    it("uploads text file", async () => {
      const ctx = buildTestContext();
      (ctx.drive.files.create as Fn).mockResolvedValue({
        data: { id: "u1", name: "notes.txt", webViewLink: "https://file" },
      });
      const tool = buildDriveManageTools(ctx).find((t) => t.name === "upload_text_file")!;
      const result = await tool.handler(ctx, {
        name: "notes.txt",
        content: "some text",
        folder_id: "root",
      });
      expect((result.content[0]! as { text: string }).text).toContain('File "notes.txt" uploaded');
    });
  });
});
