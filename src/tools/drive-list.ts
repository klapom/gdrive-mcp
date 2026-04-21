import type { ToolDef } from "@klapom/mcp-toolkit-ts";
import { z } from "zod";
import type { ToolsContext } from "./context.js";

const MIME_LABELS: Record<string, string> = {
  "application/vnd.google-apps.folder": "folder",
  "application/vnd.google-apps.document": "Google Doc",
  "application/vnd.google-apps.spreadsheet": "Google Sheet",
  "application/vnd.google-apps.presentation": "Google Slides",
  "application/vnd.google-apps.form": "Google Form",
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "text/plain": "text",
  "application/zip": "ZIP",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function buildDriveListTools(
  _ctx: ToolsContext,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous Zod shapes per tool
): Array<ToolDef<any, ToolsContext>> {
  const list_files: ToolDef<z.ZodRawShape, ToolsContext> = {
    name: "list_files",
    description: "List files and folders in Google Drive. Optionally filter by folder or type.",
    shape: {
      folder_id: z
        .string()
        .default("root")
        .describe("Folder ID to list contents of. Use 'root' for My Drive."),
      limit: z.number().int().min(1).max(100).default(20).describe("Max number of files to return"),
      type: z
        .enum(["all", "folders", "documents", "sheets", "files"])
        .default("all")
        .describe("Filter by type"),
    },
    handler: async (ctx, args) => {
      const { folder_id, limit, type } = args as {
        folder_id: string;
        limit: number;
        type: "all" | "folders" | "documents" | "sheets" | "files";
      };
      let mimeFilter = "";
      switch (type) {
        case "folders":
          mimeFilter = " and mimeType='application/vnd.google-apps.folder'";
          break;
        case "documents":
          mimeFilter = " and mimeType='application/vnd.google-apps.document'";
          break;
        case "sheets":
          mimeFilter = " and mimeType='application/vnd.google-apps.spreadsheet'";
          break;
        case "files":
          mimeFilter = " and mimeType!='application/vnd.google-apps.folder'";
          break;
      }

      const q = `'${folder_id}' in parents and trashed=false${mimeFilter}`;
      const res = await ctx.drive.files.list({
        q,
        pageSize: limit,
        fields: "files(id,name,mimeType,size,modifiedTime,parents,webViewLink)",
        orderBy: "folder,name",
      });

      const files = (res.data.files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        type: MIME_LABELS[f.mimeType ?? ""] ?? f.mimeType,
        size: f.size ? formatBytes(Number.parseInt(f.size)) : null,
        modified: f.modifiedTime,
        link: f.webViewLink,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
      };
    },
  };

  const get_file_info: ToolDef<z.ZodRawShape, ToolsContext> = {
    name: "get_file_info",
    description: "Get metadata for a specific file or folder by its ID.",
    shape: {
      file_id: z.string().describe("Google Drive file or folder ID"),
    },
    handler: async (ctx, args) => {
      const { file_id } = args as { file_id: string };
      const res = await ctx.drive.files.get({
        fileId: file_id,
        fields: "id,name,mimeType,size,modifiedTime,createdTime,parents,webViewLink,owners,shared",
      });

      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    },
  };

  return [list_files, get_file_info];
}
