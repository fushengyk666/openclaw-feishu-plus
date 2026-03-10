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
      const { cfg, accountId, setStatus, log, abortSignal } = ctx;
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
          onMessage: ctx.onMessage,
        });
      } else {
        return startWebhookListener({
          cfg,
          accountId,
          feishuCfg,
          abortSignal,
          onMessage: ctx.onMessage,
        });
      }
    },
  },

  // ─── Mentions ───

  mentions: {
    stripPatterns: () => ['<at user_id="[^"]*">[^<]*</at>'],
  },
};

// ─── WebSocket Listener ───

async function startWebSocketListener(params: {
  cfg: any;
  accountId: string;
  feishuCfg: FeishuAccountConfig;
  abortSignal: AbortSignal;
  onMessage: (msg: any) => void;
}) {
  const { cfg, accountId, feishuCfg, abortSignal, onMessage } = params;

  const client = new lark.Client({
    appId: (feishuCfg.appId || "") as string,
    appSecret: (feishuCfg.appSecret || "") as string,
    domain:
      feishuCfg.domain === "lark"
        ? lark.Domain.Lark
        : lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.warn,
  });

  const eventDispatcher = new lark.EventDispatcher({
    verificationToken: feishuCfg.verificationToken,
    encryptKey: feishuCfg.encryptKey,
  }).register({
    "im.message.receive_v1": async (data: any) => {
      await onMessage({
        accountId,
        message: data.message,
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
  // Gateway treats promise resolution as "channel exited" and triggers restart.
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
  onMessage: (msg: any) => void;
}) {
  const { cfg, accountId, feishuCfg, abortSignal, onMessage } = params;

  const eventDispatcher = new lark.EventDispatcher({
    verificationToken: feishuCfg.verificationToken,
    encryptKey: feishuCfg.encryptKey,
  }).register({
    "im.message.receive_v1": async (data: any) => {
      await onMessage({
        accountId,
        message: data.message,
      });
    },
  });

  const expressHandler = lark.adaptExpress(eventDispatcher, {
    autoChallenge: true,
  });

  const port = Number(feishuCfg.webhookPort || 3000);
  const host = feishuCfg.webhookHost || "0.0.0.0";
  const webhookPath = feishuCfg.webhookPath || "/webhook/feishu-plus";

  // Use native http instead of express to avoid extra dependency
  const http = await import("http");

  // Return a promise that stays pending until abortSignal fires.
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
