import type { docs_v1, drive_v3 } from "googleapis";
import pino from "pino";
import { vi } from "vitest";
import type { ToolsContext } from "./context.js";

export function buildTestContext(
  driveOverrides: Partial<drive_v3.Drive["files"]> = {},
  docsOverrides: Partial<docs_v1.Docs["documents"]> = {},
): ToolsContext {
  const drive = {
    files: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      copy: vi.fn(),
      delete: vi.fn(),
      export: vi.fn(),
      ...driveOverrides,
    },
    permissions: {
      create: vi.fn(),
    },
  } as unknown as drive_v3.Drive;

  const docs = {
    documents: {
      create: vi.fn(),
      batchUpdate: vi.fn(),
      ...docsOverrides,
    },
  } as unknown as docs_v1.Docs;

  return {
    logger: pino({ level: "silent" }),
    drive,
    docs,
  };
}
