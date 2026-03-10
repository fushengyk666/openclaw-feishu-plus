/**
 * plugin.ts — OpenClaw Feishu Plus Channel Plugin
 *
 * 完整的 OpenClaw ChannelPlugin 实现，对标 OpenClau feishu 扩展。
 * 同时保留 dual-token / token-first 核心架构。
 */

import * as lark from "@larksuiteoapi/node-sdk";
import type { PluginConfig } from "../core/config-schema.js";
import type { TokenResolver } from "../core/token-resolver.js";

import { PLUGIN_ID, CHANNEL_ID } from "../constants.js";

// Account & Config Management
import {
  getFeishuPlusAccountIds,
  getDefaultFeishuPlusAccountId,
  resolveFeishuPlusAccount,
  type ResolvedFeishuAccount,
  type FeishuAccountConfig,
} from "./accounts.js";

// Directory
import {
  listFeishuPlusDirectoryPeers,
  listFeishuPlusDirectoryGroups,
  listFeishuPlusDirectoryPeersLive,
  listFeishuPlusDirectoryGroupsLive,
} from "./directory.js";

// Targets
import {
  normalizeFeishuPlusTarget,
  looksLikeFeishuPlusId,
  formatFeishuPlusTarget,
} from "./targets.js";

// Messaging & Onboarding
import { sendMessageFeishu } from "./send.js";
import { feishuPlusOnboardingAdapter } from "./onboarding.js";

// Probe
import { probeFeishuPlus } from "./probe.js";

// ─── Meta ───

const meta = {
  id: CHANNEL_ID,
  label: "Feishu Plus",
  selectionLabel: "Feishu/Lark (飞书)",
  docsPath: "/channels/feishu-plus",
  docsLabel: "feishu-plus",
  blurb: "飞书/Lark 企业消息与文档工具，支持 dual-token 自动切换。",
  aliases: ["lark", "feishu-plus"],
  order: 36,
};

// ─── Constants ───

const PAIRING_APPROVED_MESSAGE =
  "配对成功！您现在已经可以在飞书中与我对话了。";

const DEFAULT_ACCOUNT_ID = "default";

// ─── Config Helpers ───

function setFeishuPlusNamedAccountEnabled(
  cfg: any,
  accountId: string,
  enabled: boolean
): any {
  const namespace = "openclaw-feishu-plus";
  const section = cfg?.channels?.[namespace];
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      [namespace]: {
        ...section,
        accounts: {
          ...(section?.accounts ?? {}),
          [accountId]: {
            ...(section?.accounts?.[accountId] ?? {}),
            enabled,
          },
        },
      },
    },
  };
}

function resolveFeishuPlusConfig(cfg: any): FeishuAccountConfig | undefined {
  return cfg?.channels?.["openclaw-feishu-plus"];
}

// ─── Group Policy Resolution ───

function resolveFeishuPlusGroupToolPolicy(cfg: any, accountId: string): "allow" | "deny" {
  const section = resolveFeishuPlusConfig(cfg);
  const account = resolveFeishuPlusAccount(cfg, accountId);
  const groupPolicy = account.config?.groupPolicy ?? "disabled";

  // "open" mode: allow all groups
  if (groupPolicy === "open") {
    return "allow";
  }

  // "disabled" mode: deny all group tools
  if (groupPolicy === "disabled") {
    return "deny";
  }

  // "allowlist" mode: check groupAllowFrom
  const groupAllowFrom = account.config?.groupAllowFrom ?? [];
  if (groupAllowFrom.length === 0) {
    return "deny";
  }

  return "allow";
}

// ─── Channel Plugin Definition ───

export const feishuPlusPlugin: any = {
  id: CHANNEL_ID,
  meta: { ...meta },

  // ─── Pairing ───

  pairing: {
    idLabel: "feishuUserId",
    normalizeAllowEntry: (entry: string) =>
      entry.replace(/^(feishu|user|open_id):/i, ""),
    notifyApproval: async ({ cfg, id }: { cfg: any; id: string }) => {
      await sendMessageFeishu({
        cfg,
        to: id,
        text: PAIRING_APPROVED_MESSAGE,
      });
    },
  },

  // ─── Capabilities ───

  capabilities: {
    chatTypes: ["direct", "channel"],
    media: true,
    reactions: true,
    threads: true,
    polls: false,
    nativeCommands: true,
    blockStreaming: true,
    edit: true,
    reply: true,
  },

  // ─── Agent Prompt ───

  agentPrompt: {
    messageToolHints: () => [
      "- Feishu Plus targeting: omit `target` to reply to the current conversation (auto-inferred). Explicit targets: `user:open_id` or `chat:chat_id`.",
      "- Feishu Plus supports interactive cards for rich messages.",
      "- Feishu Plus reactions use UPPERCASE emoji type names (e.g. `OK`,`THUMBSUP`,`THANKS`,`MUSCLE`,`FINGERHEART`,`APPLAUSE`,`FISTBUMP`,`JIAYI`,`DONE`,`SMILE`,`BLUSH`), not Unicode emoji characters.",
      "- Feishu Plus dual-token mode: automatically uses user_access_token when available, otherwise tenant_access_token.",
    ],
  },

  // ─── Groups ───

  groups: {
    resolveToolPolicy: (cfg: any, accountId: string) =>
      resolveFeishuPlusGroupToolPolicy(cfg, accountId),
  },

  // ─── Reload ───

  reload: { configPrefixes: ["channels.openclaw-feishu-plus"] },

  // ─── Config Schema (JSON Schema) ───

  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        defaultAccount: { type: "string" },
        appId: { type: "string" },
        appSecret: { type: "string" },
        encryptKey: { type: "string" },
        verificationToken: { type: "string" },
        domain: {
          oneOf: [
            { type: "string", enum: ["feishu", "lark"] },
            { type: "string", format: "uri", pattern: "^https://" },
          ],
        },
        connectionMode: { type: "string", enum: ["websocket", "webhook"] },
        webhookPath: { type: "string" },
        webhookHost: { type: "string" },
        webhookPort: { type: "integer", minimum: 1 },
        dmPolicy: { type: "string", enum: ["open", "pairing", "allowlist"] },
        allowFrom: {
          type: "array",
          items: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
        groupPolicy: {
          type: "string",
          enum: ["open", "allowlist", "disabled"],
        },
        groupAllowFrom: {
          type: "array",
          items: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
        requireMention: { type: "boolean" },
        groupSessionScope: {
          type: "string",
          enum: ["group", "group_sender", "group_topic", "group_topic_sender"],
        },
        topicSessionMode: { type: "string", enum: ["disabled", "enabled"] },
        replyInThread: { type: "string", enum: ["disabled", "enabled"] },
        historyLimit: { type: "integer", minimum: 0 },
        dmHistoryLimit: { type: "integer", minimum: 0 },
        textChunkLimit: { type: "integer", minimum: 1 },
        chunkMode: { type: "string", enum: ["length", "newline"] },
        mediaMaxMb: { type: "number", minimum: 0 },
        renderMode: { type: "string", enum: ["auto", "raw", "card"] },
        auth: {
          type: "object",
          properties: {
            preferUserToken: { type: "boolean" },
            autoPromptUserAuth: { type: "boolean" },
            store: { type: "string" },
            redirectUri: { type: "string" },
          },
        },
        tools: {
          type: "object",
          properties: {
            doc: { type: "boolean" },
            calendar: { type: "boolean" },
            oauth: { type: "boolean" },
            wiki: { type: "boolean" },
            drive: { type: "boolean" },
            bitable: { type: "boolean" },
            task: { type: "boolean" },
            chat: { type: "boolean" },
            perm: { type: "boolean" },
          },
        },
      },
    },
  },

  // ─── Config Adapter ───

  config: {
    listAccountIds: (cfg: any) => getFeishuPlusAccountIds(cfg),
    resolveAccount: (cfg: any, accountId: string) =>
      resolveFeishuPlusAccount(cfg, accountId),
    defaultAccountId: (cfg: any) => getDefaultFeishuPlusAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }: any) => {
      const account = resolveFeishuPlusAccount(cfg, accountId);
      const isDefault = accountId === DEFAULT_ACCOUNT_ID;

      if (isDefault) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            "openclaw-feishu-plus": {
              ...(cfg.channels?.["openclaw-feishu-plus"] ?? {}),
              enabled,
            },
          },
        };
      }

      return setFeishuPlusNamedAccountEnabled(cfg, accountId, enabled);
    },
    deleteAccount: ({ cfg, accountId }: any) => {
      const isDefault = accountId === DEFAULT_ACCOUNT_ID;

      if (isDefault) {
        const next = { ...cfg };
        const nextChannels = { ...cfg.channels };
        delete (nextChannels as any)["openclaw-feishu-plus"];
        if (Object.keys(nextChannels).length > 0) {
          next.channels = nextChannels;
        } else {
          delete next.channels;
        }
        return next;
      }

      const section = resolveFeishuPlusConfig(cfg);
      const accounts = { ...(section?.accounts ?? {}) };
      delete accounts[accountId];

      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          "openclaw-feishu-plus": {
            ...section,
            accounts: Object.keys(accounts).length > 0 ? accounts : undefined,
          },
        },
      };
    },
    isConfigured: (account: ResolvedFeishuAccount) => account.configured,
    describeAccount: (account: ResolvedFeishuAccount) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: account.name,
      appId: account.appId,
      domain: account.domain,
    }),
    resolveAllowFrom: ({ cfg, accountId }: any) => {
      const account = resolveFeishuPlusAccount(cfg, accountId);
      return ((account.config?.allowFrom ?? []) as any[]).map((entry: any) => String(entry));
    },
    formatAllowFrom: ({ allowFrom }: any) =>
      ((allowFrom ?? []) as any[])
        .map((entry: any) => String(entry).trim())
        .filter(Boolean)
        .map((entry: any) => entry.toLowerCase()),
  },

  // ─── Security ───

  security: {
    collectWarnings: ({ cfg, accountId }: any) => {
      const account = resolveFeishuPlusAccount(cfg, accountId);
      const feishuCfg = account.config;
      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = feishuCfg?.groupPolicy ?? defaultGroupPolicy ?? "allowlist";

      if (groupPolicy !== "open") {
        return [];
      }

      return [
        `- FeishuPlus[${account.accountId}] groups: groupPolicy="open" allows any group to interact (mention-gated). To restrict which groups are allowed, set groupPolicy="allowlist" and list group IDs in channels.openclaw-feishu-plus.groups. To restrict which senders can trigger the bot, set channels.openclaw-feishu-plus.groupAllowFrom with user open_ids (ou_xxx).`,
      ];
    },
  },

  // ─── Setup ───

  setup: {
    resolveAccountId: () => DEFAULT_ACCOUNT_ID,
    applyAccountConfig: ({ cfg, accountId }: any) => {
      const isDefault = !accountId || accountId === DEFAULT_ACCOUNT_ID;

      if (isDefault) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            "openclaw-feishu-plus": {
              ...(cfg.channels?.["openclaw-feishu-plus"] ?? {}),
              enabled: true,
            },
          },
        };
      }

      return setFeishuPlusNamedAccountEnabled(cfg, accountId, true);
    },
  },

  // ─── Onboarding ───

  onboarding: feishuPlusOnboardingAdapter,

  // ─── Messaging ───

  messaging: {
    normalizeTarget: (raw: any) => normalizeFeishuPlusTarget(raw) ?? undefined,
    targetResolver: {
      looksLikeId: looksLikeFeishuPlusId,
      hint: "<chatId|user:openId|chat:chatId>",
    },
  },

  // ─── Directory ───

  directory: {
    self: async () => null,
    listPeers: async ({ cfg, query, limit, accountId }: any) =>
      listFeishuPlusDirectoryPeers({
        cfg,
        query: query ?? undefined,
        limit: limit ?? undefined,
        accountId: accountId ?? undefined,
      }),
    listGroups: async ({ cfg, query, limit, accountId }: any) =>
      listFeishuPlusDirectoryGroups({
        cfg,
        query: query ?? undefined,
        limit: limit ?? undefined,
        accountId: accountId ?? undefined,
      }),
    listPeersLive: async ({ cfg, query, limit, accountId }: any) =>
      listFeishuPlusDirectoryPeersLive({
        cfg,
        query: query ?? undefined,
        limit: limit ?? undefined,
        accountId: accountId ?? undefined,
      }),
    listGroupsLive: async ({ cfg, query, limit, accountId }: any) =>
      listFeishuPlusDirectoryGroupsLive({
        cfg,
        query: query ?? undefined,
        limit: limit ?? undefined,
        accountId: accountId ?? undefined,
      }),
  },

  // ─── Outbound ───

  outbound: async (ctx: any) => {
    const { cfg, to, message, accountId } = ctx;

    // Ensure to is resolved
    const resolvedTo = normalizeFeishuPlusTarget(to);
    if (!resolvedTo) {
      throw new Error(`Invalid Feishu target: ${to}`);
    }

    await sendMessageFeishu({
      cfg,
      to: resolvedTo,
      text: message?.text,
      msgType: message?.msgType,
      content: message?.content,
      accountId: accountId,
    });
  },

  // ─── Status ───

  status: {
    defaultRuntime: () => ({
      accountId: DEFAULT_ACCOUNT_ID,
      port: null,
    }),
    buildChannelSummary: ({ snapshot }: any) => {
      const account = snapshot?.account;
      const probe = snapshot?.probe;

      return {
        channel: CHANNEL_ID,
        enabled: account?.enabled ?? false,
        configured: account?.configured ?? false,
        name: account?.name,
        appId: account?.appId,
        domain: account?.domain,
        probe: probe,
        port: snapshot?.port ?? null,
      };
    },
    probeAccount: async ({ account }: { account: ResolvedFeishuAccount }) => {
      return await probeFeishuPlus(account.config);
    },
    buildAccountSnapshot: ({ account, runtime, probe }: any) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: account.name,
      appId: account.appId,
      domain: account.domain,
      ...runtime,
      probe,
      port: runtime?.port ?? null,
    }),
  },

  // ─── Gateway (Start Listener) ───

  gateway: {
    startAccount: async (ctx: any) => {
      const { cfg, accountId, setStatus, log, abortSignal, runtime, channelRuntime } = ctx;
      const account = resolveFeishuPlusAccount(cfg, accountId);
      const feishuCfg = account.config;
      const connectionMode = feishuCfg?.connectionMode ?? "websocket";
      const port = feishuCfg?.webhookPort ?? null;

      setStatus?.({
        accountId,
        port,
      });

      log?.info(
        `starting feishu-plus[${accountId}] (mode: ${connectionMode})`
      );

      if (connectionMode === "websocket") {
        return startWebSocketListener({
          cfg,
          accountId,
          feishuCfg,
          abortSignal,
          log,
          runtime,
          channelRuntime,
        });
      } else {
        return startWebhookListener({
          cfg,
          accountId,
          feishuCfg,
          abortSignal,
          log,
          runtime,
          channelRuntime,
        });
      }
    },
  },

  // ─── Mentions ───

  mentions: {
    stripPatterns: () => ['<at user_id="[^"]*">[^<]*</at>'],
  },
};

// ─── Message Handler ───

/**
 * Parse a Feishu message event and dispatch it to the OpenClaw agent
 * via channelRuntime (Plugin SDK).
 */
async function handleInboundMessage(params: {
  cfg: any;
  accountId: string;
  feishuCfg: FeishuAccountConfig;
  event: any;
  log: any;
  runtime: any;
  channelRuntime: any;
}) {
  const { cfg, accountId, feishuCfg, event, log, runtime, channelRuntime } = params;
  const logFn = log?.info ?? console.log;
  const errorFn = log?.error ?? console.error;

  // Shared Lark client for this handler invocation
  const client = new lark.Client({
    appId: (feishuCfg.appId || "") as string,
    appSecret: (feishuCfg.appSecret || "") as string,
    domain: feishuCfg.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.warn,
  });

  try {
    const message = event.message;
    const sender = event.sender;
    if (!message || !sender) return;

    const messageId = message.message_id;
    const chatId = message.chat_id ?? "";
    const chatType = message.chat_type ?? "p2p"; // p2p or group
    const senderOpenId = sender.sender_id?.open_id ?? "";
    const isDirect = chatType === "p2p";

    // Parse message content
    let content = "";
    try {
      const body = JSON.parse(message.content || "{}");
      content = body.text ?? body.content ?? "";
    } catch {
      content = message.content ?? "";
    }

    if (!content.trim()) return;

    // ── Resolve sender name ──
    let senderName = senderOpenId;
    if (feishuCfg.resolveSenderNames !== false) {
      try {
        const userResp = await client.contact.user.get({
          path: { user_id: senderOpenId },
          params: { user_id_type: "open_id" },
        });
        const name = (userResp?.data?.user as any)?.name;
        if (name) senderName = name;
      } catch {
        // Best-effort, fall back to open_id
      }
    }

    logFn(`feishu-plus[${accountId}]: message from ${senderName}(${senderOpenId}) in ${chatId} (${chatType}): ${content.slice(0, 80)}`);

    if (!channelRuntime) {
      logFn(`feishu-plus[${accountId}]: channelRuntime not available, cannot dispatch`);
      return;
    }

    // ── Typing indicator: add reaction ──
    let typingReactionId: string | null = null;
    if (feishuCfg.typingIndicator !== false && messageId) {
      try {
        const typingResp = await client.im.messageReaction.create({
          path: { message_id: messageId },
          data: { reaction_type: { emoji_type: "Typing" } },
        });
        typingReactionId = (typingResp?.data as any)?.reaction_id ?? null;
      } catch {
        // Best-effort
      }
    }

    // Helper to remove typing indicator
    const removeTyping = async () => {
      if (!typingReactionId || !messageId) return;
      try {
        await client.im.messageReaction.delete({
          path: { message_id: messageId, reaction_id: typingReactionId },
        });
      } catch {
        // Best-effort
      }
      typingReactionId = null;
    };

    // ── Resolve agent route ──
    const peer = { kind: (isDirect ? "direct" : "group") as "direct" | "group", id: isDirect ? senderOpenId : chatId };
    
    let route: any;
    try {
      route = channelRuntime.routing.resolveAgentRoute({
        cfg,
        channel: CHANNEL_ID,
        accountId,
        peer,
      });
    } catch (routeErr: any) {
      errorFn(`feishu-plus[${accountId}]: route resolution failed: ${String(routeErr)}`);
      await removeTyping();
      return;
    }

    // ── Build inbound context ──
    const from = `${CHANNEL_ID}:${isDirect ? "direct" : chatId}:${senderOpenId}`;
    const to = `${CHANNEL_ID}:${isDirect ? "direct" : chatId}`;

    const envelope = channelRuntime.reply.formatAgentEnvelope({
      channel: "Feishu",
      from,
      timestamp: new Date(),
      body: content,
    });

    const ctxPayload = channelRuntime.reply.finalizeInboundContext({
      Body: envelope,
      BodyForAgent: content,
      RawBody: content,
      CommandBody: content,
      From: from,
      To: to,
      SessionKey: route.sessionKey,
      AgentId: route.agentId,
      AccountId: route.accountId ?? accountId,
      ChatType: isDirect ? "direct" : "group",
      SenderName: senderName,
      SenderId: senderOpenId,
      Provider: CHANNEL_ID as any,
      Surface: CHANNEL_ID as any,
      MessageSid: messageId,
      Timestamp: Date.now(),
      WasMentioned: true,
      OriginatingChannel: CHANNEL_ID as any,
      OriginatingTo: to,
    });

    // ── Send reply helper ──
    const sendReply = async (text: string) => {
      try {
        const targetId = isDirect ? senderOpenId : chatId;
        const receiveIdType = isDirect ? "open_id" : "chat_id";
        await client.im.message.create({
          params: { receive_id_type: receiveIdType },
          data: {
            receive_id: targetId,
            msg_type: "text",
            content: JSON.stringify({ text }),
          },
        });
      } catch (err) {
        errorFn(`feishu-plus[${accountId}]: failed to send reply: ${String(err)}`);
      }
    };

    // ── Streaming card constants ──
    const STREAMING_ELEMENT_ID = "streaming_content";
    const useStreaming = feishuCfg.streaming === true && isDirect; // streaming only in DM for now
    let cardKitCardId: string | null = null;
    let cardKitSequence = 0;
    let accumulatedText = "";
    let cardMessageId: string | null = null;

    // ── CardKit helpers ──
    const createStreamingCard = async (): Promise<boolean> => {
      try {
        const thinkingCard = {
          schema: "2.0",
          config: { streaming_mode: true, summary: { content: "思考中..." } },
          body: {
            elements: [
              {
                tag: "markdown",
                content: "",
                text_align: "left",
                text_size: "normal_v2",
                element_id: STREAMING_ELEMENT_ID,
              },
            ],
          },
        };

        // Step 1: Create card entity
        const createResp = await client.cardkit.v1.card.create({
          data: { type: "card_json", data: JSON.stringify(thinkingCard) },
        });
        cardKitCardId = (createResp?.data as any)?.card_id ?? null;
        if (!cardKitCardId) return false;
        cardKitSequence = 1;

        // Step 2: Send IM message referencing card_id
        const targetId = isDirect ? senderOpenId : chatId;
        const receiveIdType = isDirect ? "open_id" : "chat_id";
        const sendResp = await client.im.message.create({
          params: { receive_id_type: receiveIdType },
          data: {
            receive_id: targetId,
            msg_type: "interactive",
            content: JSON.stringify({ type: "card", data: { card_id: cardKitCardId } }),
          },
        });
        cardMessageId = (sendResp?.data as any)?.message_id ?? null;
        logFn(`feishu-plus[${accountId}]: streaming card created (card_id=${cardKitCardId}, msg_id=${cardMessageId})`);
        return true;
      } catch (err: any) {
        const detail = err?.response?.data ? JSON.stringify(err.response.data) : String(err);
        errorFn(`feishu-plus[${accountId}]: failed to create streaming card: ${detail}`);
        return false;
      }
    };

    const updateStreamingContent = async (text: string) => {
      if (!cardKitCardId) return;
      try {
        cardKitSequence++;
        await (client.cardkit as any).v1.cardElement.content({
          data: { content: text, sequence: cardKitSequence },
          path: { card_id: cardKitCardId, element_id: STREAMING_ELEMENT_ID },
        });
      } catch (err) {
        errorFn(`feishu-plus[${accountId}]: stream update failed: ${String(err)}`);
      }
    };

    const finalizeCard = async (fullText: string) => {
      if (!cardKitCardId) return;
      try {
        // Build final card
        const finalCard = {
          schema: "2.0",
          config: { streaming_mode: false },
          body: {
            elements: [
              { tag: "markdown", content: fullText, text_align: "left", text_size: "normal_v2" },
            ],
          },
        };
        cardKitSequence++;
        await (client.cardkit as any).v1.card.update({
          data: { card: { type: "card_json", data: JSON.stringify(finalCard) }, sequence: cardKitSequence },
          path: { card_id: cardKitCardId },
        });
        // Close streaming mode
        cardKitSequence++;
        await (client.cardkit as any).v1.card.settings({
          data: { settings: JSON.stringify({ streaming_mode: false }), sequence: cardKitSequence },
          path: { card_id: cardKitCardId },
        });
      } catch (err) {
        errorFn(`feishu-plus[${accountId}]: finalize card failed: ${String(err)}`);
      }
    };

    // ── Dispatch to agent ──
    let streamingCardCreated = false;
    try {
      const result = await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg,
        dispatcherOptions: {
          deliver: async (payload: any, info: any) => {
            const text = payload?.text ?? payload?.body ?? payload?.content ?? "";
            if (!text?.trim()) return;

            if (useStreaming) {
              // Streaming card mode
              if (!streamingCardCreated) {
                streamingCardCreated = await createStreamingCard();
              }
              if (streamingCardCreated && cardKitCardId) {
                accumulatedText += text;
                if (info?.kind === "final") {
                  await updateStreamingContent(accumulatedText);
                  await finalizeCard(accumulatedText);
                } else {
                  await updateStreamingContent(accumulatedText);
                }
              } else {
                // Fallback to plain text if card creation failed
                await sendReply(text);
              }
            } else {
              // Static mode: send plain text
              await sendReply(text);
            }
          },
        },
      });
      logFn(`feishu-plus[${accountId}]: dispatchReply result: ${JSON.stringify(result)}`);
    } catch (dispatchErr: any) {
      errorFn(`feishu-plus[${accountId}]: dispatchReply failed: ${String(dispatchErr)}`);
    } finally {
      await removeTyping();
    }

    logFn(`feishu-plus[${accountId}]: dispatch complete for message ${messageId}`);
  } catch (err) {
    errorFn(`feishu-plus[${accountId}]: error handling message: ${String(err)}`);
  }
}

// ─── WebSocket Listener ───

async function startWebSocketListener(params: {
  cfg: any;
  accountId: string;
  feishuCfg: FeishuAccountConfig;
  abortSignal: AbortSignal;
  log: any;
  runtime: any;
  channelRuntime: any;
}) {
  const { cfg, accountId, feishuCfg, abortSignal, log, runtime, channelRuntime } = params;

  const eventDispatcher = new lark.EventDispatcher({
    verificationToken: feishuCfg.verificationToken,
    encryptKey: feishuCfg.encryptKey,
  }).register({
    "im.message.receive_v1": async (data: any) => {
      await handleInboundMessage({
        cfg,
        accountId,
        feishuCfg,
        event: data,
        log,
        runtime,
        channelRuntime,
      });
    },
  });

  const wsClient = new lark.WSClient({
    appId: feishuCfg.appId || "" as string,
    appSecret: feishuCfg.appSecret || "" as string,
    domain:
      feishuCfg.domain === "lark"
        ? lark.Domain.Lark
        : lark.Domain.Feishu,
    autoReconnect: true,
    loggerLevel: lark.LoggerLevel.warn,
  });

  // Return a promise that stays pending until abortSignal fires.
  return new Promise<void>((resolve) => {
    const handleAbort = () => {
      wsClient.close({ force: true });
      resolve();
    };

    if (abortSignal.aborted) {
      handleAbort();
      return;
    }

    abortSignal.addEventListener("abort", handleAbort, { once: true });
    wsClient.start({ eventDispatcher });
  });
}

// ─── Webhook Listener ───

async function startWebhookListener(params: {
  cfg: any;
  accountId: string;
  feishuCfg: FeishuAccountConfig;
  abortSignal: AbortSignal;
  log: any;
  runtime: any;
  channelRuntime: any;
}) {
  const { cfg, accountId, feishuCfg, abortSignal, log, runtime, channelRuntime } = params;

  const eventDispatcher = new lark.EventDispatcher({
    verificationToken: feishuCfg.verificationToken,
    encryptKey: feishuCfg.encryptKey,
  }).register({
    "im.message.receive_v1": async (data: any) => {
      await handleInboundMessage({
        cfg,
        accountId,
        feishuCfg,
        event: data,
        log,
        runtime,
        channelRuntime,
      });
    },
  });

  const expressHandler = lark.adaptExpress(eventDispatcher, {
    autoChallenge: true,
  });

  const port = Number(feishuCfg.webhookPort || 3000);
  const host = feishuCfg.webhookHost || "0.0.0.0";
  const webhookPath = feishuCfg.webhookPath || "/webhook/feishu-plus";

  const http = await import("http");

  return new Promise<void>((resolve, reject) => {
    const server = http.createServer((req: any, res: any) => {
      if (req.url?.startsWith(webhookPath)) {
        expressHandler(req, res);
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    const handleAbort = () => {
      server.close();
      resolve();
    };

    if (abortSignal.aborted) {
      resolve();
      return;
    }

    abortSignal.addEventListener("abort", handleAbort, { once: true });
    server.listen(port, host, () => {
      /* server running, promise stays pending until abort */
    });
    server.on("error", (err: any) => {
      abortSignal.removeEventListener("abort", handleAbort);
      reject(err);
    });
  });
}
