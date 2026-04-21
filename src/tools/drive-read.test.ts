import { describe, expect, it } from "vitest";
import { buildDriveReadTools } from "./drive-read.js";
import { buildTestContext } from "./test-helpers.js";

type Fn = ReturnType<typeof import("vitest").vi.fn>;

describe("drive-read tools", () => {
  it("registers read_file", () => {
    const ctx = buildTestContext();
    const tools = buildDriveReadTools(ctx);
    expect(tools.map((t) => t.name)).toContain("read_file");
  });

  it("exports Google Docs as text/plain", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.get as Fn).mockResolvedValue({
      data: { id: "1", name: "Doc", mimeType: "application/vnd.google-apps.document" },
    });
    (ctx.drive.files.export as Fn).mockResolvedValue({ data: "Hello world" });

    const tool = buildDriveReadTools(ctx).find((t) => t.name === "read_file")!;
    const result = await tool.handler(ctx, { file_id: "1", max_chars: 10000 });
    expect((result.content[0]! as { text: string }).text).toContain("Hello world");
    expect((result.content[0]! as { text: string }).text).toContain("File: Doc");
    expect(ctx.drive.files.export as Fn).toHaveBeenCalledWith(
      { fileId: "1", mimeType: "text/plain" },
      { responseType: "text" },
    );
  });

  it("exports Google Sheets as CSV", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.get as Fn).mockResolvedValue({
      data: { id: "2", name: "Sheet", mimeType: "application/vnd.google-apps.spreadsheet" },
    });
    (ctx.drive.files.export as Fn).mockResolvedValue({ data: "a,b\n1,2" });

    const tool = buildDriveReadTools(ctx).find((t) => t.name === "read_file")!;
    const result = await tool.handler(ctx, { file_id: "2", max_chars: 10000 });
    expect((result.content[0]! as { text: string }).text).toContain("a,b");
  });

  it("reads regular text files via download", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.get as Fn)
      .mockResolvedValueOnce({
        data: { id: "3", name: "notes.txt", mimeType: "text/plain" },
      })
      .mockResolvedValueOnce({ data: "file content here" });

    const tool = buildDriveReadTools(ctx).find((t) => t.name === "read_file")!;
    const result = await tool.handler(ctx, { file_id: "3", max_chars: 10000 });
    expect((result.content[0]! as { text: string }).text).toContain("file content here");
  });

  it("returns error for binary files", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.get as Fn).mockResolvedValue({
      data: { id: "4", name: "photo.jpg", mimeType: "image/jpeg" },
    });

    const tool = buildDriveReadTools(ctx).find((t) => t.name === "read_file")!;
    const result = await tool.handler(ctx, { file_id: "4", max_chars: 10000 });
    expect(result.isError).toBe(true);
    expect((result.content[0]! as { text: string }).text).toContain("binary file");
  });

  it("returns error for PDF files", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.get as Fn).mockResolvedValue({
      data: { id: "5", name: "report.pdf", mimeType: "application/pdf" },
    });

    const tool = buildDriveReadTools(ctx).find((t) => t.name === "read_file")!;
    const result = await tool.handler(ctx, { file_id: "5", max_chars: 10000 });
    expect(result.isError).toBe(true);
    expect((result.content[0]! as { text: string }).text).toContain("binary file");
  });

  it("truncates long content", async () => {
    const ctx = buildTestContext();
    (ctx.drive.files.get as Fn).mockResolvedValue({
      data: { id: "6", name: "Doc", mimeType: "application/vnd.google-apps.document" },
    });
    (ctx.drive.files.export as Fn).mockResolvedValue({ data: "x".repeat(200) });

    const tool = buildDriveReadTools(ctx).find((t) => t.name === "read_file")!;
    const result = await tool.handler(ctx, { file_id: "6", max_chars: 100 });
    expect((result.content[0]! as { text: string }).text).toContain("[Truncated to 100 chars]");
  });
});
