/**
 * platform/sheets/client.ts — Feishu Sheets Domain Client
 *
 * Platform layer wraps Feishu OpenAPI endpoints and keeps tools thin.
 * All calls go through identity/feishu-api so dual-auth decisions apply.
 */

import { feishuGet, feishuPost, type IdentityMode } from "../../identity/feishu-api.js";

export async function getSpreadsheet(params: {
  spreadsheetToken: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "sheets.spreadsheet.get",
    `/open-apis/sheets/v3/spreadsheets/${params.spreadsheetToken}`,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function createSpreadsheet(params: {
  title: string;
  folderToken?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuPost(
    "sheets.spreadsheet.create",
    "/open-apis/sheets/v3/spreadsheets",
    {
      title: params.title,
      folder_token: params.folderToken,
    },
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function querySheet(params: {
  spreadsheetToken: string;
  sheetId: string;
  range?: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const range = params.range ?? `${params.sheetId}!A1:Z1000`;
  const result = await feishuGet(
    "sheets.spreadsheet.query",
    `/open-apis/sheets/v2/spreadsheets/${params.spreadsheetToken}/values/${encodeURIComponent(range)}`,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function findInSheet(params: {
  spreadsheetToken: string;
  sheetId: string;
  find: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const range = `${params.sheetId}!A1:Z1000`;
  const result = await feishuPost(
    "sheets.spreadsheet.find",
    `/open-apis/sheets/v2/spreadsheets/${params.spreadsheetToken}/find`,
    {
      find_condition: { range },
      find: params.find,
    },
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}

export async function listSheets(params: {
  spreadsheetToken: string;
  userId?: string;
  identityMode?: IdentityMode;
}) {
  const result = await feishuGet(
    "sheets.spreadsheet.listSheets",
    `/open-apis/sheets/v3/spreadsheets/${params.spreadsheetToken}/sheets/query`,
    { userId: params.userId, identityMode: params.identityMode },
  );
  return result.data;
}
