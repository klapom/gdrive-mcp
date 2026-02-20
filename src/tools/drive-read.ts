import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { z } from "zod";

// Google Workspace MIME types → export format
const EXPORT_FORMATS: Record<string, { mimeType: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mimeType: "text/plain",
    ext: "txt",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "text/csv",
    ext: "csv",
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "text/plain",
    ext: "txt",
  },
};

export function registerDriveReadTools(server: McpServer, auth: OAuth2Client) {
  const drive = google.drive({ version: "v3", auth });

  server.tool(
    "read_file",
    "Read the text content of a file from Google Drive. Works with Google Docs, Sheets (as CSV), plain text files, and other text formats. Binary files (images, PDFs) are not supported for content reading.",
    {
      file_id: z.string().describe("Google Drive file ID"),
      max_chars: z
        .number()
        .int()
        .min(100)
        .max(100000)
        .default(10000)
        .describe("Max characters to return (to avoid huge files)"),
    },
    async ({ file_id, max_chars }) => {
      // Get file metadata first
      const meta = await drive.files.get({
        fileId: file_id,
        fields: "id,name,mimeType,size",
      });

      const mimeType = meta.data.mimeType ?? "";
      const name = meta.data.name ?? file_id;

      // Google Workspace files need export
      const exportFormat = EXPORT_FORMATS[mimeType];
      if (exportFormat) {
        const res = await drive.files.export(
          { fileId: file_id, mimeType: exportFormat.mimeType },
          { responseType: "text" },
        );
        const content = String(res.data).slice(0, max_chars);
        const truncated = String(res.data).length > max_chars;
        return {
          content: [
            {
              type: "text",
              text: `File: ${name}\nType: ${mimeType}\n${truncated ? `[Truncated to ${max_chars} chars]\n` : ""}\n---\n${content}`,
            },
          ],
        };
      }

      // Regular files: download content
      if (
        mimeType.startsWith("text/") ||
        mimeType === "application/json" ||
        mimeType === "application/xml"
      ) {
        const res = await drive.files.get(
          { fileId: file_id, alt: "media" },
          { responseType: "text" },
        );
        const content = String(res.data).slice(0, max_chars);
        const truncated = String(res.data).length > max_chars;
        return {
          content: [
            {
              type: "text",
              text: `File: ${name}\n${truncated ? `[Truncated to ${max_chars} chars]\n` : ""}\n---\n${content}`,
            },
          ],
        };
      }

      // Unsupported binary type
      return {
        content: [
          {
            type: "text",
            text: `Cannot read "${name}" (${mimeType}) — binary file. Use get_file_info for metadata or the webViewLink to open it.`,
          },
        ],
        isError: true,
      };
    },
  );
}
