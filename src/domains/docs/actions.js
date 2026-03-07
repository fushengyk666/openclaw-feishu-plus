import { FeishuPlusError } from "../../core/errors.js";

function requireParams(params, names, action) {
  for (const n of names) {
    if (params[n] === undefined || params[n] === null || params[n] === "") {
      throw new FeishuPlusError("invalid_params", `${action} 缺少必填参数: ${n}`);
    }
  }
}

function pickMembers(raw) {
  const items = raw?.data?.items || [];
  return items.map((m) => ({
    member_type: m.member_type,
    member_id: m.member_id,
    perm: m.perm,
    name: m.name,
  }));
}

export async function runDocsAction(client, pluginCfg, params) {
  const action = params.action;
  const token = params.token;
  const type = params.type;

  if (action === "list_permissions") {
    requireParams(params, ["token", "type"], action);
    const res = await client.listPermissionMembers(token, type);
    return { ok: true, domain: "docs", action, token, type, members: pickMembers(res) };
  }

  if (action === "add_permission") {
    requireParams(params, ["token", "type", "member_type", "member_id", "perm"], action);
    const listed = await client.listPermissionMembers(token, type);
    const members = pickMembers(listed);
    const existed = members.find(
      (m) => m.member_type === params.member_type && m.member_id === params.member_id,
    );
    if (existed && existed.perm === params.perm) {
      return {
        ok: true,
        domain: "docs",
        action,
        token,
        type,
        noop: true,
        reason: "member_already_exists_with_same_perm",
        member: existed,
      };
    }

    const needNotification =
      typeof params.need_notification === "boolean"
        ? params.need_notification
        : Boolean(pluginCfg?.defaultNeedNotification);

    const added = await client.addPermissionMember(
      token,
      type,
      params.member_type,
      params.member_id,
      params.perm,
      needNotification,
    );

    return {
      ok: true,
      domain: "docs",
      action,
      token,
      type,
      noop: false,
      member: added?.data?.member || null,
    };
  }

  if (action === "remove_permission") {
    requireParams(params, ["token", "type", "member_type", "member_id"], action);
    await client.deletePermissionMember(token, type, params.member_type, params.member_id);
    return {
      ok: true,
      domain: "docs",
      action,
      token,
      type,
      removed: true,
      member_type: params.member_type,
      member_id: params.member_id,
    };
  }

  throw new FeishuPlusError("invalid_action", `不支持的 docs action: ${action}`);
}
