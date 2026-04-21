import type { ToolDef } from "@klapom/mcp-toolkit-ts";
import { z } from "zod";
import type { ToolsContext } from "./context.js";

export function buildDriveSearchTools(
  _ctx: ToolsContext,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous Zod shapes per tool
): Array<ToolDef<any, ToolsContext>> {
  const search_files: ToolDef<z.ZodRawShape, ToolsContext> = {
    name: "search_files",
    description: "Search for files in Google Drive by name or content.",
    shape: {
      query: z.string().describe("Search text to look for"),
      search_in: z
        .enum(["name", "content", "both"])
        .default("name")
        .describe("Search in file name, full text content (slower), or both"),
      limit: z.number().int().min(1).max(50).default(10).describe("Max results"),
    },
    handler: async (ctx, args) => {
      const { query, search_in, limit } = args as {
        query: string;
        search_in: "name" | "content" | "both";
        limit: number;
      };
      const escaped = query.replace(/'/g, "\\'");
      let q: string;
      switch (search_in) {
        case "name":
          q = `name contains '${escaped}' and trashed=false`;
          break;
        case "content":
          q = `fullText contains '${escaped}' and trashed=false`;
          break;
        default:
          q = `(name contains '${escaped}' or fullText contains '${escaped}') and trashed=false`;
      }

      const res = await ctx.drive.files.list({
        q,
        pageSize: limit,
        fields: "files(id,name,mimeType,size,modifiedTime,parents,webViewLink)",
        orderBy: "modifiedTime desc",
      });

      const files = (res.data.files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modified: f.modifiedTime,
        link: f.webViewLink,
      }));

      return {
        content: [
          {
            type: "text",
            text:
              files.length === 0
                ? `No files found for: "${query}"`
                : JSON.stringify(files, null, 2),
          },
        ],
      };
    },
  };

  return [search_files];
}
