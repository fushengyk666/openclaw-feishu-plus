/**
 * reply-mode.ts — scene-aware reply mode resolution
 *
 * Closely follows official openclaw-lark card/reply-mode.ts logic,
 * adapted to Feishu Plus account config shape.
 */

import type { FeishuAccountConfig } from "./accounts.js";

export type ReplyModeValue = "auto" | "static" | "streaming";

export function resolveReplyMode(params: {
  feishuCfg: FeishuAccountConfig | undefined;
  chatType?: "p2p" | "group";
}): ReplyModeValue {
  const { feishuCfg, chatType } = params;

  if (feishuCfg?.streaming !== true) return "static";

  const replyMode = (feishuCfg as any)?.replyMode as
    | ReplyModeValue
    | { default?: ReplyModeValue; direct?: ReplyModeValue; group?: ReplyModeValue }
    | undefined;

  if (!replyMode) return "auto";
  if (typeof replyMode === "string") return replyMode;

  const sceneMode = chatType === "group"
    ? replyMode.group
    : chatType === "p2p"
      ? replyMode.direct
      : undefined;
  return sceneMode ?? replyMode.default ?? "auto";
}

export function expandAutoMode(params: {
  mode: ReplyModeValue;
  streaming: boolean | undefined;
  chatType?: "p2p" | "group";
}): "static" | "streaming" {
  const { mode, streaming, chatType } = params;
  if (mode !== "auto") return mode;
  return streaming === true ? (chatType === "group" ? "static" : "streaming") : "static";
}
