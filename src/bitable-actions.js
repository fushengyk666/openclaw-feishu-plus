import { FeishuPlusError } from "./errors.js";

function requireParams(params, names, action) {
  for (const n of names) {
    if (params[n] === undefined || params[n] === null || params[n] === "") {
      throw new FeishuPlusError("invalid_params", `${action} 缺少必填参数: ${n}`);
    }
  }
}

export async function runBitableAction(client, params) {
  const { action, app_token } = params;

  if (action === "list_tables") {
    const res = await client.bitableListTables(app_token);
    return {
      ok: true,
      action,
      app_token,
      tables: res?.data?.items || [],
      page_token: res?.data?.page_token || null,
      has_more: Boolean(res?.data?.has_more),
    };
  }

  if (action === "create_table") {
    requireParams(params, ["table_name"], action);
    const res = await client.bitableCreateTable(app_token, params.table_name);
    return {
      ok: true,
      action,
      app_token,
      table: res?.data?.table || null,
    };
  }

  if (action === "delete_record") {
    requireParams(params, ["table_id", "record_id"], action);
    await client.bitableDeleteRecord(app_token, params.table_id, params.record_id);
    return {
      ok: true,
      action,
      app_token,
      table_id: params.table_id,
      record_id: params.record_id,
      deleted: true,
    };
  }

  if (action === "batch_create_records") {
    requireParams(params, ["table_id", "records"], action);
    const res = await client.bitableBatchCreateRecords(app_token, params.table_id, params.records);
    return {
      ok: true,
      action,
      app_token,
      table_id: params.table_id,
      created: res?.data?.records || [],
    };
  }

  if (action === "batch_update_records") {
    requireParams(params, ["table_id", "records"], action);
    for (const [i, r] of params.records.entries()) {
      if (!r?.record_id) {
        throw new FeishuPlusError("invalid_params", `batch_update_records 第 ${i + 1} 项缺少 record_id`);
      }
    }
    const res = await client.bitableBatchUpdateRecords(app_token, params.table_id, params.records);
    return {
      ok: true,
      action,
      app_token,
      table_id: params.table_id,
      updated: res?.data?.records || [],
    };
  }

  if (action === "batch_delete_records") {
    requireParams(params, ["table_id", "record_ids"], action);
    const res = await client.bitableBatchDeleteRecords(app_token, params.table_id, params.record_ids);
    return {
      ok: true,
      action,
      app_token,
      table_id: params.table_id,
      deleted: res?.data?.records || params.record_ids,
    };
  }

  throw new FeishuPlusError("invalid_action", `不支持的 bitable action: ${action}`);
}
