import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { z } from "zod";

export function registerDriveSearchTools(server: McpServer, auth: OAuth2Client) {
  const drive = google.drive({ version: "v3", auth });

  server.tool(
    "search_files",
    "Search for files in Google Drive by name or content.",
    {
      query: z.string().describe("Search text to look for"),
      search_in: z
        .enum(["name", "content", "both"])
        .default("name")
        .describe(
          "Search in file name, full text content (slower), or both",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Max results"),
    },
    async ({ query, search_in, limit }) => {
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

      const res = await drive.files.list({
        q,
        pageSize: limit,
        fields:
          "files(id,name,mimeType,size,modifiedTime,parents,webViewLink)",
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
  );
}
