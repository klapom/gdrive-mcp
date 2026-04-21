import { describe, expect, it } from "vitest";
import { buildDriveSearchTools } from "./drive-search.js";
import { buildTestContext } from "./test-helpers.js";

type Fn = ReturnType<typeof import("vitest").vi.fn>;

describe("drive-search tools", () => {
  it("registers search_files", () => {
    const ctx = buildTestContext();
    const tools = buildDriveSearchTools(ctx);
    expect(tools.map((t) => t.name)).toContain("search_files");
  });

  it("builds name query", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.list as Fn).mockResolvedValue({ data: { files: [] } });
    const tool = buildDriveSearchTools(ctx).find((t) => t.name === "search_files")!;
    await tool.handler(ctx, { query: "test", search_in: "name", limit: 10 });
    expect((ctx.drive.files.list as Fn).mock.calls[0][0].q).toBe(
      "name contains 'test' and trashed=false",
    );
  });

  it("builds content query", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.list as Fn).mockResolvedValue({ data: { files: [] } });
    const tool = buildDriveSearchTools(ctx).find((t) => t.name === "search_files")!;
    await tool.handler(ctx, { query: "test", search_in: "content", limit: 10 });
    expect((ctx.drive.files.list as Fn).mock.calls[0][0].q).toBe(
      "fullText contains 'test' and trashed=false",
    );
  });

  it("builds both query", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.list as Fn).mockResolvedValue({ data: { files: [] } });
    const tool = buildDriveSearchTools(ctx).find((t) => t.name === "search_files")!;
    await tool.handler(ctx, { query: "test", search_in: "both", limit: 10 });
    const q = (ctx.drive.files.list as Fn).mock.calls[0][0].q;
    expect(q).toContain("name contains 'test'");
    expect(q).toContain("fullText contains 'test'");
  });

  it("escapes single quotes in query", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.list as Fn).mockResolvedValue({ data: { files: [] } });
    const tool = buildDriveSearchTools(ctx).find((t) => t.name === "search_files")!;
    await tool.handler(ctx, { query: "it's", search_in: "name", limit: 10 });
    expect((ctx.drive.files.list as Fn).mock.calls[0][0].q).toContain("it\\'s");
  });

  it("returns 'no files found' message when empty", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.list as Fn).mockResolvedValue({ data: { files: [] } });
    const tool = buildDriveSearchTools(ctx).find((t) => t.name === "search_files")!;
    const result = await tool.handler(ctx, { query: "nope", search_in: "name", limit: 10 });
    expect((result.content[0]! as { text: string }).text).toContain('No files found for: "nope"');
  });

  it("returns mapped file results", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.list as Fn).mockResolvedValue({
      data: {
        files: [
          {
            id: "1",
            name: "doc.txt",
            mimeType: "text/plain",
            modifiedTime: "2026-01-01",
            webViewLink: "https://x",
          },
        ],
      },
    });
    const tool = buildDriveSearchTools(ctx).find((t) => t.name === "search_files")!;
    const result = await tool.handler(ctx, { query: "doc", search_in: "name", limit: 10 });
    const files = JSON.parse((result.content[0]! as { text: string }).text);
    expect(files[0].id).toBe("1");
    expect(files[0].name).toBe("doc.txt");
  });
});
