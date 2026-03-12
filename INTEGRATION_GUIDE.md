# OpenClaw 集成指南

本文档说明如何在 OpenClaw 中集成 openclaw-feishu-plus。

---

## 概述

openclaw-feishu-plus 提供两种主要能力：

1. **Tools**: 飞书 API 工具集（文档、日历、云盘等）
2. **Channel**: 飞书消息通道（WebSocket/Webhook）

插件侧已完成所有可实现的部分，现在需要 OpenClaw 侧进行对接。

---

## 插件入口接口

插件提供一个标准的入口函数 `register`：

```typescript
import feishuPlugin from "openclaw-feishu-plus";

const plugin = await feishuPlugin.register(config, api);
```

### 参数说明

#### `config`

插件配置对象，从 `openclaw.json` 读取。

```typescript
{
  enabled: true,
  mode: "full" | "tools-only",
  connectionMode: "websocket" | "webhook",
  appId: "cli_xxxxxxxxxxxxxxxx",
  appSecret: "xxxxxxxxxxxxxxxx",
  domain: "feishu" | "lark",
  auth: {
    preferUserToken: true,
    redirectUri: "https://open.feishu.cn/oauth/callback"
  },
  tools: {
    doc: true,
    calendar: true,
    oauth: true,
    wiki: true,
    drive: true,
    bitable: true,
    task: true,
    chat: true,
    perm: true
  }
}
```

#### `api`

OpenClaw 提供的 API 对象。

```typescript
interface OpenClawPluginAPI {
  registerTool: (tool: {
    name: string;
    description: string;
    parameters: unknown;
    execute: ToolExecute;
  }) => void;

  registerChannel: (channelId: string, handler: FeishuChannelHandler) => void;

  storagePath?: string;

  inboundBridge?: InboundMessageBridge;
}
```

---

## 集成步骤

### 步骤 1: 实现 InboundMessageBridge

**目的**: 将飞书消息注入到 OpenClaw 消息总线。

```typescript
import type { FeishuInboundMessage, InboundMessageBridge } from "openclaw-feishu-plus";

const inboundBridge: InboundMessageBridge = {
  handleInbound: async (message: FeishuInboundMessage) => {
    // 将飞书消息注入到 OpenClaw 消息总线
    console.log(`[OpenClaw] Received message from ${message.sender.openId}:`, message.content.text);

    // 触发 AI 处理（示例）
    const response = await openClaw.ai.process({
      channel: message.channelId,
      user: message.sender.openId,
      message: message.content.text || "",
      raw: message,
    });

    // 发送回复
    const channel = await openClaw.getChannel("openclaw-feishu-plus");
    if (channel && channel.sendMessage) {
      await channel.sendMessage(
        message.chatId,
        "text",
        JSON.stringify({ text: response }),
        message.sender.userId  // 使用 user token
      );
    }
  }
};
```

**FeishuInboundMessage 结构**:

```typescript
interface FeishuInboundMessage {
  channelId: string;
  messageType: string;
  content: {
    text?: string;
    rawData?: Record<string, unknown>;
  };
  sender: {
    openId: string;
    userId?: string;
    unionId?: string;
    senderType: "user" | "app";
  };
  chatId: string;
  rawEvent: FeishuMessage;
  timestamp: number;
}
```

### 步骤 2: 注册插件

```typescript
import feishuPlugin from "openclaw-feishu-plus";

const config = {
  // 从 openclaw.json 读取的配置
  enabled: true,
  mode: "full",
  connectionMode: "websocket",
  appId: "cli_xxxxxxxxxxxxxxxx",
  appSecret: "xxxxxxxxxxxxxxxx",
  domain: "feishu",
  auth: {
    preferUserToken: true,
    redirectUri: "https://open.feishu.cn/oauth/callback"
  },
  tools: {
    doc: true,
    calendar: true,
    oauth: true,
    wiki: true,
    drive: true,
    bitable: true,
    task: true,
    chat: true,
    perm: true
  }
};

const plugin = await feishuPlugin.register(config, {
  registerTool: (tool) => {
    // 注册工具到 OpenClaw
    openClaw.tools.register(tool);
  },
  registerChannel: (channelId, handler) => {
    // 注册 channel 到 OpenClaw
    openClaw.channels.register(channelId, handler);
  },
  storagePath: "~/.openclaw/data/openclaw-feishu-plus",
  inboundBridge: inboundBridge  // 传入实现
});

// 保存 plugin 实例，用于后续调用
openClaw.plugins.set("openclaw-feishu-plus", plugin);
```

### 步骤 3: 处理 Channel Handler

插件注册时会调用 `registerChannel`，OpenClaw 需要保存 channel handler：

```typescript
// OpenClaw 侧实现
const channelHandlers = new Map<string, FeishuChannelHandler>();

function registerChannel(channelId: string, handler: FeishuChannelHandler) {
  console.log(`[OpenClaw] Registering channel: ${channelId}`);
  channelHandlers.set(channelId, handler);
}

function getChannel(channelId: string): FeishuChannelHandler | undefined {
  return channelHandlers.get(channelId);
}
```

**FeishuChannelHandler 接口**:

```typescript
interface FeishuChannelHandler {
  // 基础连接管理
  isConnected(): boolean;
  disconnect(): Promise<void>;

  // 出站消息（发送消息到飞书）
  sendMessage?(chatId: string, msgType: string, content: string, userId?: string): Promise<unknown>;

  // Webhook HTTP handlers（仅在 webhook 模式下可用）
  expressHandler?: any;
  koaHandler?: any;

  // Channel 元数据
  metadata?: {
    connectionMode: "websocket" | "webhook";
    capabilities: string[];
    supportsInbound: boolean;
    supportsOutbound: boolean;
  };
}
```

### 步骤 4: 使用 Channel Handler

OpenClaw 可以通过 channel handler 向飞书发送消息：

```typescript
// 发送消息到飞书
async function sendToFeishu(chatId: string, text: string, userId?: string) {
  const channel = getChannel("openclaw-feishu-plus");
  if (channel && channel.sendMessage) {
    await channel.sendMessage(
      chatId,
      "text",
      JSON.stringify({ text }),
      userId  // 可选，用于决定使用 user token
    );
  } else {
    console.error(`[OpenClaw] Feishu channel not available`);
  }
}

// 使用示例
await sendToFeishu("oc_xxxxxxxxxxxxxxxx", "Hello from OpenClaw!");
await sendToFeishu("oc_xxxxxxxxxxxxxxxx", "Hello from User!", "ou_xxxxxxxxxxxxxxxx");
```

### 步骤 5: 集成 Webhook Handler（可选）

如果使用 Webhook 模式，需要在 HTTP 服务器上集成：

```javascript
// Express 示例
import express from "express";
import feishuPlugin from "openclaw-feishu-plus";

const app = express();

const plugin = await feishuPlugin.register(config, {
  registerTool: (tool) => {},
  registerChannel: (channelId, handler) => {
    if (channelId === "openclaw-feishu-plus") {
      // 注册 Webhook handler
      app.use("/webhook/feishu", handler.expressHandler);
    }
  },
  inboundBridge: inboundBridge
});

app.listen(3000);
```

```javascript
// Koa 示例
import Koa from "koa";
import feishuPlugin from "openclaw-feishu-plus";

const app = new Koa();

const plugin = await feishuPlugin.register(config, {
  registerTool: (tool) => {},
  registerChannel: (channelId, handler) => {
    if (channelId === "openclaw-feishu-plus") {
      // 注册 Webhook handler
      app.use(handler.koaHandler);
    }
  },
  inboundBridge: inboundBridge
});

app.listen(3000);
```

### 步骤 6: 插件关闭

OpenClaw 关闭时需要调用插件的 shutdown 方法：

```typescript
async function shutdown() {
  const plugin = openClaw.plugins.get("openclaw-feishu-plus");
  if (plugin && plugin.shutdown) {
    await plugin.shutdown();
    console.log(`[OpenClaw] Feishu plugin shutdown complete`);
  }
}
```

---

## 完整集成示例

```typescript
import feishuPlugin, { type FeishuInboundMessage, type InboundMessageBridge, type FeishuChannelHandler } from "openclaw-feishu-plus";

// 1. 实现 InboundMessageBridge
const inboundBridge: InboundMessageBridge = {
  handleInbound: async (message: FeishuInboundMessage) => {
    console.log(`[OpenClaw] Message from ${message.sender.openId}:`, message.content.text);

    // 触发 AI 处理
    const response = await openClaw.ai.process({
      channel: message.channelId,
      user: message.sender.openId,
      message: message.content.text || "",
    });

    // 发送回复
    const channel = openClaw.getChannel("openclaw-feishu-plus");
    if (channel && channel.sendMessage) {
      await channel.sendMessage(
        message.chatId,
        "text",
        JSON.stringify({ text: response }),
        message.sender.userId
      );
    }
  }
};

// 2. 注册插件
const config = {
  enabled: true,
  mode: "full",
  connectionMode: "websocket",
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
  domain: "feishu",
  auth: {
    preferUserToken: true,
    redirectUri: "https://open.feishu.cn/oauth/callback"
  },
  tools: {
    doc: true,
    calendar: true,
    oauth: true,
    wiki: true,
    drive: true,
    bitable: true,
    task: true,
    chat: true,
    perm: true
  }
};

const plugin = await feishuPlugin.register(config, {
  registerTool: (tool) => {
    openClaw.tools.register(tool);
  },
  registerChannel: (channelId, handler) => {
    openClaw.channels.register(channelId, handler);
  },
  storagePath: "~/.openclaw/data/openclaw-feishu-plus",
  inboundBridge: inboundBridge
});

// 3. 保存插件实例
openClaw.plugins.set("openclaw-feishu-plus", plugin);

// 4. 使用 channel handler
async function sendToFeishu(chatId: string, text: string) {
  const channel = openClaw.getChannel("openclaw-feishu-plus");
  if (channel && channel.sendMessage) {
    await channel.sendMessage(chatId, "text", JSON.stringify({ text }));
  }
}

// 5. 关闭插件
process.on("SIGTERM", async () => {
  const plugin = openClaw.plugins.get("openclaw-feishu-plus");
  if (plugin && plugin.shutdown) {
    await plugin.shutdown();
  }
  process.exit(0);
});
```

---

## 集成测试清单

- [ ] InboundMessageBridge 实现正确
- [ ] 插件注册成功
- [ ] Channel handler 保存正确
- [ ] WebSocket 连接成功（如果使用 WebSocket 模式）
- [ ] Webhook handler 注册成功（如果使用 Webhook 模式）
- [ ] 飞书消息能正确注入到 OpenClaw
- [ ] OpenClaw 能调用 `channel.sendMessage`
- [ ] User token 和 Tenant token 都能正常工作
- [ ] 插件关闭时正确清理资源

---

## 常见问题

### Q: 如果不提供 InboundMessageBridge 会怎样？

A: 插件仍能正常工作，但飞书消息只会被记录到日志，不会注入到 OpenClaw 消息总线。

### Q: 如何切换 User Token 和 Tenant Token？

A: 调用 `channel.sendMessage` 时传入 `userId` 参数，插件会自动使用 User Token；不传入 `userId` 时使用 Tenant Token。

### Q: WebSocket 和 Webhook 模式如何选择？

A:
- **WebSocket**: 推荐，实时性好，不需要配置 HTTP 服务器
- **Webhook**: 需要公开可访问的 HTTP 服务器，但更灵活

### Q: 如何调试集成？

A:
1. 检查插件日志（插件会输出详细的注册和连接信息）
2. 检查 OpenClaw 日志
3. 验证 `inboundBridge` 是否正确实现
4. 验证 `channel.sendMessage` 是否正确调用

---

## 参考资料

- [CLOSURE_STATUS.md](./CLOSURE_STATUS.md) - 插件闭环状态详细说明
- [README.md](./README.md) - 插件使用说明
- [DESIGN.md](./DESIGN.md) - 架构设计文档

---

## 联系方式

如有问题，请提交 Issue 或 Pull Request。
