/**
 * media.ts — Feishu Plus Media Upload/Send
 *
 * 处理图片、文件等媒体的上传和发送。
 */

import { getLarkClient } from "../core/client.js";
import { resolveReceiveIdType } from "./targets.js";
import { sendMessageFeishu } from "./send.js";
import * as fs from "fs";

/**
 * Upload an image to Feishu and return the image_key.
 */
export async function uploadImageFeishu(params: {
  cfg: any;
  imagePath?: string;
  imageBuffer?: Buffer;
  imageType?: string;
  accountId?: string;
}): Promise<string | null> {
  const feishuCfg = params.cfg?.channels?.["openclaw-feishu-plus"] ?? params.cfg;
  const client = getLarkClient(feishuCfg);

  const data: any = {
    image_type: params.imageType || "message",
  };

  if (params.imagePath) {
    (data as any).file = fs.createReadStream(params.imagePath);
  } else if (params.imageBuffer) {
    (data as any).file = params.imageBuffer;
  } else {
    return null;
  }

  const resp = await client.im.image.create({ data });
  return ((resp as any)?.data?.image_key) ?? null;
}

/**
 * Upload a file to Feishu and return the file_key.
 */
export async function uploadFileFeishu(params: {
  cfg: any;
  filePath?: string;
  fileBuffer?: Buffer;
  fileName: string;
  fileType?: string;
  accountId?: string;
}): Promise<string | null> {
  const feishuCfg = params.cfg?.channels?.["openclaw-feishu-plus"] ?? params.cfg;
  const client = getLarkClient(feishuCfg);

  const data: any = {
    file_type: params.fileType || "stream",
    file_name: params.fileName,
  };

  if (params.filePath) {
    (data as any).file = fs.createReadStream(params.filePath);
  } else if (params.fileBuffer) {
    (data as any).file = params.fileBuffer;
  } else {
    return null;
  }

  const resp = await client.im.file.create({ data });
  return ((resp as any)?.data?.file_key) ?? null;
}

/**
 * Send an image message.
 */
export async function sendImageFeishu(params: {
  cfg: any;
  to: string;
  imageKey: string;
  accountId?: string;
}): Promise<any> {
  return sendMessageFeishu({
    cfg: params.cfg,
    to: params.to,
    msgType: "image",
    content: JSON.stringify({ image_key: params.imageKey }),
    accountId: params.accountId,
  });
}

/**
 * Send a file message.
 */
export async function sendFileFeishu(params: {
  cfg: any;
  to: string;
  fileKey: string;
  accountId?: string;
}): Promise<any> {
  return sendMessageFeishu({
    cfg: params.cfg,
    to: params.to,
    msgType: "file",
    content: JSON.stringify({ file_key: params.fileKey }),
    accountId: params.accountId,
  });
}

/**
 * Upload and send media (auto-detect image vs file).
 */
export async function sendMediaFeishu(params: {
  cfg: any;
  to: string;
  filePath: string;
  fileName?: string;
  accountId?: string;
}): Promise<any> {
  const ext = params.filePath.split(".").pop()?.toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext || "");

  if (isImage) {
    const imageKey = await uploadImageFeishu({
      cfg: params.cfg,
      imagePath: params.filePath,
      accountId: params.accountId,
    });
    if (!imageKey) throw new Error("Failed to upload image");
    return sendImageFeishu({
      cfg: params.cfg,
      to: params.to,
      imageKey,
      accountId: params.accountId,
    });
  } else {
    const fileKey = await uploadFileFeishu({
      cfg: params.cfg,
      filePath: params.filePath,
      fileName: params.fileName || params.filePath.split("/").pop() || "file",
      accountId: params.accountId,
    });
    if (!fileKey) throw new Error("Failed to upload file");
    return sendFileFeishu({
      cfg: params.cfg,
      to: params.to,
      fileKey,
      accountId: params.accountId,
    });
  }
}
