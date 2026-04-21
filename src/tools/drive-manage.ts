import { Readable } from "node:stream";
import type { ToolDef } from "@klapom/mcp-toolkit-ts";
import { z } from "zod";
import type { ToolsContext } from "./context.js";

export function buildDriveManageTools(
  _ctx: ToolsContext,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous Zod shapes per tool
): Array<ToolDef<any, ToolsContext>> {
  const create_folder: ToolDef<z.ZodRawShape, ToolsContext> = {
    name: "create_folder",
    description: "Create a new folder in Google Drive.",
    shape: {
      name: z.string().describe("Folder name"),
      parent_id: z.string().default("root").describe("Parent folder ID. Default: root (My Drive)"),
    },
    handler: async (ctx, args) => {
      const { name, parent_id } = args as { name: string; parent_id: string };
      const res = await ctx.drive.files.create({
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
  };

  const rename_file: ToolDef<z.ZodRawShape, ToolsContext> = {
    name: "rename_file",
    description: "Rename a file or folder in Google Drive.",
    shape: {
      file_id: z.string().describe("File or folder ID"),
      new_name: z.string().describe("New name"),
    },
    handler: async (ctx, args) => {
      const { file_id, new_name } = args as { file_id: string; new_name: string };
      const res = await ctx.drive.files.update({
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
  };

  const move_file: ToolDef<z.ZodRawShape, ToolsContext> = {
    name: "move_file",
    description: "Move a file or folder to a different parent folder.",
    shape: {
      file_id: z.string().describe("File or folder ID to move"),
      destination_folder_id: z
        .string()
        .describe("Target folder ID (use list_files to find folder IDs)"),
    },
    handler: async (ctx, args) => {
      const { file_id, destination_folder_id } = args as {
        file_id: string;
        destination_folder_id: string;
      };
      // Get current parents to remove them
      const meta = await ctx.drive.files.get({
        fileId: file_id,
        fields: "parents,name",
      });
      const oldParents = (meta.data.parents ?? []).join(",");

      const res = await ctx.drive.files.update({
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
  };

  const delete_file: ToolDef<z.ZodRawShape, ToolsContext> = {
    name: "delete_file",
    description: "Move a file or folder to Google Drive Trash.",
    shape: {
      file_id: z.string().describe("File or folder ID to trash"),
    },
    handler: async (ctx, args) => {
      const { file_id } = args as { file_id: string };
      const meta = await ctx.drive.files.get({
        fileId: file_id,
        fields: "name",
      });
      await ctx.drive.files.update({
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
  };

  const create_document: ToolDef<z.ZodRawShape, ToolsContext> = {
    name: "create_document",
    description: "Create a new Google Doc with initial text content.",
    shape: {
      name: z.string().describe("Document name"),
      content: z.string().describe("Initial text content"),
      folder_id: z.string().default("root").describe("Parent folder ID. Default: root"),
    },
    handler: async (ctx, args) => {
      const { name, content, folder_id } = args as {
        name: string;
        content: string;
        folder_id: string;
      };
      // Create empty Google Doc
      const res = await ctx.drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.document",
          parents: [folder_id],
        },
        fields: "id,name,webViewLink",
      });

      // Write content via Docs API
      await ctx.docs.documents.batchUpdate({
        // biome-ignore lint/style/noNonNullAssertion: drive.files.create returns id
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
  };

  const upload_text_file: ToolDef<z.ZodRawShape, ToolsContext> = {
    name: "upload_text_file",
    description: "Upload a text file to Google Drive.",
    shape: {
      name: z.string().describe("File name (e.g. notes.txt)"),
      content: z.string().describe("Text content of the file"),
      folder_id: z.string().default("root").describe("Parent folder ID. Default: root"),
    },
    handler: async (ctx, args) => {
      const { name, content, folder_id } = args as {
        name: string;
        content: string;
        folder_id: string;
      };
      const res = await ctx.drive.files.create({
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
  };

  return [create_folder, rename_file, move_file, delete_file, create_document, upload_text_file];
}
