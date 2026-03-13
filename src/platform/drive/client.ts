/**
 * platform/drive/client.ts — Feishu Drive Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import { feishuGet, feishuPost, feishuDelete } from "../../identity/feishu-api.js";

export async function listDriveFiles(params: {
  folderToken?: string;
  pageSize?: number;
  pageToken?: string;
  orderBy?: string;
  direction?: string;
  userId?: string;
}) {
  const result = await feishuGet(
    "drive.file.list",
    "/open-apis/drive/v1/files",
    {
      userId: params.userId,
      params: {
        folder_token: params.folderToken,
        page_size: typeof params.pageSize === "number" ? params.pageSize : 50,
        page_token: params.pageToken,
        order_by: params.orderBy,
        direction: params.direction,
      },
    },
  );
  return result.data;
}

export async function getDriveFile(params: {
  fileToken: string;
  userId?: string;
}) {
  const result = await feishuPost(
    "drive.file.get",
    "/open-apis/drive/v1/metas/batch_query",
    {
      request_docs: [{ doc_token: params.fileToken, doc_type: "doc" }],
    },
    { userId: params.userId },
  );
  return result.data;
}

export async function downloadDriveFile(params: {
  fileToken: string;
  userId?: string;
}) {
  const result = await feishuPost(
    "drive.file.download",
    "/open-apis/drive/v1/metas/batch_query",
    {
      request_docs: [{ doc_token: params.fileToken, doc_type: "file" }],
    },
    { userId: params.userId },
  );
  return result.data;
}

export async function uploadDriveFile(params: {
  parentToken: string;
  fileName: string;
  fileSize: number;
  userId?: string;
}) {
  return {
    message: "File upload requires actual file content. Use the Feishu drive upload API with multipart form data.",
    parent_token: params.parentToken,
    file_name: params.fileName,
    file_size: params.fileSize,
  };
}

export async function createDriveFolder(params: {
  parentToken: string;
  folderName: string;
  userId?: string;
}) {
  const result = await feishuPost(
    "drive.file.createFolder",
    "/open-apis/drive/v1/files/create_folder",
    {
      name: params.folderName,
      folder_token: params.parentToken,
    },
    { userId: params.userId },
  );
  return result.data;
}

export async function deleteDriveFile(params: {
  fileToken: string;
  type: string;
  userId?: string;
}) {
  const result = await feishuDelete(
    "drive.file.delete",
    `/open-apis/drive/v1/files/${params.fileToken}`,
    {
      userId: params.userId,
      params: { type: params.type },
    },
  );
  return result.data;
}

export async function copyDriveFile(params: {
  fileToken: string;
  name: string;
  type: string;
  folderToken: string;
  userId?: string;
}) {
  const result = await feishuPost(
    "drive.file.copy",
    `/open-apis/drive/v1/files/${params.fileToken}/copy`,
    {
      name: params.name,
      type: params.type,
      folder_token: params.folderToken,
    },
    { userId: params.userId },
  );
  return result.data;
}

export async function moveDriveFile(params: {
  fileToken: string;
  type: string;
  folderToken: string;
  userId?: string;
}) {
  const result = await feishuPost(
    "drive.file.move",
    `/open-apis/drive/v1/files/${params.fileToken}/move`,
    {
      type: params.type,
      folder_token: params.folderToken,
    },
    { userId: params.userId },
  );
  return result.data;
}
