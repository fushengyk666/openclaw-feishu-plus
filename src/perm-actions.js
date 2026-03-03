import { FeishuPlusError } from "./errors.js";

function pickMembers(raw) {
  const items = raw?.data?.items || [];
  return items.map((m) => ({
    member_type: m.member_type,
    member_id: m.member_id,
    perm: m.perm,
    name: m.name,
  }));
}

export async function runPermAction(client, pluginCfg, params) {
  const { action, token, type } = params;
  if (action === "list") {
    const res = await client.listPermissionMembers(token, type);
    return { ok: true, action, token, type, members: pickMembers(res) };
  }

  if (action === "add") {
    if (!params.member_type || !params.member_id || !params.perm) {
      throw new FeishuPlusError("invalid_params", "add 需要 member_type/member_id/perm");
    }
    // idempotent add
    const listed = await client.listPermissionMembers(token, type);
    const members = pickMembers(listed);
    const existed = members.find(
      (m) => m.member_type === params.member_type && m.member_id === params.member_id,
    );
    if (existed && existed.perm === params.perm) {
      return {
        ok: true,
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
      action,
      token,
      type,
      noop: false,
      member: added?.data?.member || null,
    };
  }

  if (action === "remove") {
    if (!params.member_type || !params.member_id) {
      throw new FeishuPlusError("invalid_params", "remove 需要 member_type/member_id");
    }
    await client.deletePermissionMember(token, type, params.member_type, params.member_id);
    return {
      ok: true,
      action,
      token,
      type,
      removed: true,
      member_type: params.member_type,
      member_id: params.member_id,
    };
  }

  throw new FeishuPlusError("invalid_action", `不支持的 action: ${action}`);
}
