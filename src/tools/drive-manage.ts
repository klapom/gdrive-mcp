import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { z } from "zod";

export function registerDriveManageTools(server: McpServer, auth: OAuth2Client) {
  const drive = google.drive({ version: "v3", auth });

  server.tool(
    "create_folder",
    "Create a new folder in Google Drive.",
    {
      name: z.string().describe("Folder name"),
      parent_id: z
        .string()
        .default("root")
        .describe("Parent folder ID. Default: root (My Drive)"),
    },
    async ({ name, parent_id }) => {
      const res = await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parent_id],
        },
        fields: "id,name,webViewLink",
      });
      return {
        content: [
          {
            type: "text",
            text: `Folder "${res.data.name}" created.\nID: ${res.data.id}\nLink: ${res.data.webViewLink}`,
          },
        ],
      };
    },
  );

  server.tool(
    "rename_file",
    "Rename a file or folder in Google Drive.",
    {
      file_id: z.string().describe("File or folder ID"),
      new_name: z.string().describe("New name"),
    },
    async ({ file_id, new_name }) => {
      const res = await drive.files.update({
        fileId: file_id,
        requestBody: { name: new_name },
        fields: "id,name",
      });
      return {
        content: [
          {
            type: "text",
            text: `Renamed to "${res.data.name}" (ID: ${res.data.id})`,
          },
        ],
      };
    },
  );

  server.tool(
    "move_file",
    "Move a file or folder to a different parent folder.",
    {
      file_id: z.string().describe("File or folder ID to move"),
      destination_folder_id: z
        .string()
        .describe("Target folder ID (use list_files to find folder IDs)"),
    },
    async ({ file_id, destination_folder_id }) => {
      // Get current parents to remove them
      const meta = await drive.files.get({
        fileId: file_id,
        fields: "parents,name",
      });
      const oldParents = (meta.data.parents ?? []).join(",");

      const res = await drive.files.update({
        fileId: file_id,
        addParents: destination_folder_id,
        removeParents: oldParents,
        fields: "id,name,parents",
      });
      return {
        content: [
          {
            type: "text",
            text: `"${res.data.name}" moved successfully.`,
          },
        ],
      };
    },
  );

  server.tool(
    "delete_file",
    "Move a file or folder to Google Drive Trash.",
    {
      file_id: z.string().describe("File or folder ID to trash"),
    },
    async ({ file_id }) => {
      const meta = await drive.files.get({
        fileId: file_id,
        fields: "name",
      });
      await drive.files.update({
        fileId: file_id,
        requestBody: { trashed: true },
      });
      return {
        content: [
          {
            type: "text",
            text: `"${meta.data.name}" moved to Trash.`,
          },
        ],
      };
    },
  );

  server.tool(
    "create_document",
    "Create a new Google Doc with initial text content.",
    {
      name: z.string().describe("Document name"),
      content: z.string().describe("Initial text content"),
      folder_id: z
        .string()
        .default("root")
        .describe("Parent folder ID. Default: root"),
    },
    async ({ name, content, folder_id }) => {
      // Create empty Google Doc
      const res = await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.document",
          parents: [folder_id],
        },
        fields: "id,name,webViewLink",
      });

      // Write content via Docs API
      const docs = google.docs({ version: "v1", auth });
      await docs.documents.batchUpdate({
        documentId: res.data.id!,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content,
              },
            },
          ],
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `Document "${res.data.name}" created.\nID: ${res.data.id}\nLink: ${res.data.webViewLink}`,
          },
        ],
      };
    },
  );

  server.tool(
    "upload_text_file",
    "Upload a text file to Google Drive.",
    {
      name: z.string().describe("File name (e.g. notes.txt)"),
      content: z.string().describe("Text content of the file"),
      folder_id: z
        .string()
        .default("root")
        .describe("Parent folder ID. Default: root"),
    },
    async ({ name, content, folder_id }) => {
      const { Readable } = await import("stream");
      const res = await drive.files.create({
        requestBody: {
          name,
          parents: [folder_id],
        },
        media: {
          mimeType: "text/plain",
          body: Readable.from([content]),
        },
        fields: "id,name,webViewLink",
      });
      return {
        content: [
          {
            type: "text",
            text: `File "${res.data.name}" uploaded.\nID: ${res.data.id}\nLink: ${res.data.webViewLink}`,
          },
        ],
      };
    },
  );
}
