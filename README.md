# OpenClaw Feishu Plus

飞书增强版 OpenClaw 插件 — 同一套接口，运行时按 Token 类型自动选择身份。

## 特性

- **Token-first 架构**：身份由 `Authorization` header 的 token 类型决定
- **默认策略**：`user-if-available-else-tenant`
  - 有 `user_access_token` → 用户身份
  - 没有 → 回退 `tenant_access_token`（应用身份）
- **接口限制优先**：少数接口明确只支持某种 token 时，强制使用对应身份
- **插件共存**：独立 plugin id / channel id / config namespace，不影响其他插件
- **双模式运行**：`full` 模式支持 WebSocket/Webhook 通道监听，`tools-only` 模式仅提供工具调用
- **安全默认**：默认 `tools-only` 模式，仅启用已实现的工具

## 快速开始

### 1. 安装

```bash
cd ~/.openclaw/workspace
git clone <your-repo-url> feishu-hybrid-plugin
cd feishu-hybrid-plugin
npm install
npm run build
```

### 2. 创建飞书应用

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 在「凭证与基础信息」中获取 `App ID` 和 `App Secret`
4. 在「权限管理」中开通所需权限：
   - `docx:document` - 文档读写
   - `calendar:calendar:readonly` - 日历读取
   - `drive:drive` - 云盘读写
   - `wiki:wiki:readonly` - 知识库读取
   - `bitable:bitable:readonly` - 多维表格读取
   - `task:task:readonly` - 任务读取
   - `im:chat` - 群聊管理
   - `im:message` - 消息发送
   - `im:message:group_at_msg` - @群机器人消息

### 3. 配置 OpenClaw

在 `openclaw.json` 中添加以下配置：

```jsonc
{
  "channels": {
    "openclaw-feishu-plus": {
      "enabled": true,
      "mode": "full",
      "connectionMode": "websocket",
      "appId": "cli_xxxxxxxxxxxxxxxx",
      "appSecret": "xxxxxxxxxxxxxxxx",
      "domain": "feishu",
      "auth": {
        "preferUserToken": true,
        "redirectUri": "https://open.feishu.cn/oauth/callback"
      },
      "tools": {
        "doc": true,
        "calendar": true,
        "oauth": true,
        "wiki": true,
        "drive": true,
        "bitable": true,
        "task": true,
        "chat": true,
        "perm": true
      }
    }
  }
}
```

#### 配置说明

- **mode**: `tools-only`（默认）或 `full`
  - `tools-only`: 仅启用工具调用，不监听飞书消息
  - `full`: 启用工具调用 + Channel 消息监听

- **connectionMode**: `websocket`（推荐）或 `webhook`
  - `websocket`: 建立长连接，实时接收飞书事件
  - `webhook`: 需要 HTTP 服务器接收飞书回调

### 4. 启动 Channel（full 模式）

#### WebSocket 模式（推荐）

无需额外配置，插件启动后自动建立 WebSocket 长连接。

注意：WebSocket 模式需要在飞书开放平台开启事件订阅。

#### Webhook 模式

1. 确保有一个公开可访问的 HTTP 服务器
2. 在飞书开放平台配置 Event Webhook URL
3. 使用插件提供的 handler 集成到你的服务器：

```javascript
// Express 示例
import express from "express";
import { register } from "./feishu-hybrid-plugin/dist/index.js";

const app = express();

// 初始化插件
const plugin = await register(config, {
  registerTool: () => {},
  registerChannel: (channelId, handler) => {
    if (channelId === "openclaw-feishu-plus" && "expressHandler" in handler) {
      app.use("/webhook/feishu", handler.expressHandler);
    }
  },
});

app.listen(3000);
```

### 5. 重启 OpenClaw

```bash
# 重启 gateway
openclaw gateway restart
```

## 当前支持的能力

### ✅ 已实现

| 能力 | 工具名 | 说明 |
|------|--------|------|
| **文档** | `feishu_doc_create` | 创建飞书云文档 |
| | `feishu_doc_get` | 获取文档内容 |
| | `feishu_doc_list_blocks` | 列出文档中的块 |
| **日历** | `feishu_calendar_list` | 列出日历 |
| | `feishu_calendar_event_list` | 列出日历事件 |
| | `feishu_calendar_freebusy` | 查询忙闲状态 |
| **授权** | `feishu_auth_status` | 查看授权状态 |
| | `feishu_auth_authorize` | 触发授权流程 |
| | `feishu_auth_callback` | 处理授权回调 |
| | `feishu_auth_revoke` | 撤销授权 |
| **群聊** | `feishu_chat_list` | 列出群聊 |
| | `feishu_chat_get` | 获取群聊信息 |
| | `feishu_message_send` | 发送消息 |
| | `feishu_message_list` | 列出消息 |
| **云盘** | `feishu_drive_list_files` | 列出文件 |
| | `feishu_drive_get_file` | 获取文件信息 |
| | `feishu_drive_download_file` | 获取下载信息 |
| | `feishu_drive_upload_file` | 上传文件（准备） |
| | `feishu_drive_create_folder` | 创建文件夹 |
| **Wiki** | `feishu_wiki_list_spaces` | 列出知识库空间 |
| | `feishu_wiki_get_node` | 获取节点信息 |
| | `feishu_wiki_list_nodes` | 列出节点 |
| | `feishu_wiki_create_space` | 创建知识库空间 |
| **多维表格** | `feishu_bitable_get_app` | 获取应用信息 |
| | `feishu_bitable_list_tables` | 列出数据表 |
| | `feishu_bitable_list_records` | 列出记录 |
| | `feishu_bitable_create_record` | 创建记录 |
| | `feishu_bitable_update_record` | 更新记录 |
| | `feishu_bitable_delete_record` | 删除记录 |
| **任务** | `feishu_task_get` | 获取任务详情 |
| | `feishu_task_list` | 列出任务 |
| | `feishu_task_create` | 创建任务 |
| | `feishu_task_update` | 更新任务 |
| | `feishu_task_complete` | 完成任务 |
| **权限管理** | `feishu_drive_list_permissions` | 列出权限 |
| | `feishu_drive_create_permission` | 添加权限 |
| | `feishu_drive_update_permission` | 更新权限 |
| | `feishu_drive_delete_permission` | 删除权限 |
| | `feishu_drive_transfer_owner` | 转移所有权 |

### 🔲 未实现

以下功能尚未实现，默认禁用：

- `approval` - 审批流程
- `mail` - 邮件
- `contact` - 联系人

## Channel 消息监听

### WebSocket 模式（推荐）

插件使用 `@larksuiteoapi/node-sdk` 的 `WSClient` 建立长连接监听飞书事件。

**优势：**
- 实时性好，低延迟
- 不需要配置 HTTP 服务器
- 自动重连机制

**当前实现：**
- ✅ 建立 WebSocket 长连接
- ✅ 接收 `im.message.receive_v1` 事件
- ✅ 解析消息内容（文本、互动卡片等）
- ✅ 过滤机器人自己发送的消息
- ✅ 构造 `FeishuInboundMessage` 结构化对象
- ✅ `InboundMessageBridge` 接口已定义
- ✅ `FeishuChannelHandler` 接口已暴露给 OpenClaw
- ✅ `sendMessage` 接口已暴露（OpenClaw 可调用）
- 🔲 消息真正注入到 OpenClaw（需要 OpenClaw 提供 `InboundMessageBridge` 实现）
- 🔲 OpenClaw 调用 `channel.sendMessage`（需要 OpenClaw 实现）
- 🔲 AI 自动回复触发（需要 OpenClaw 消息处理逻辑）

**使用场景：**
```javascript
// 配置中使用 connectionMode: "websocket"
{
  "mode": "full",
  "connectionMode": "websocket"
}
```

### Webhook 模式

插件提供 `EventDispatcher` 适配器，可集成到 Express/Koa 等 HTTP 框架。

**优势：**
- 灵活，可集成到任何 HTTP 框架
- 不依赖 WebSocket 连接

**当前实现：**
- ✅ 创建 `EventDispatcher` 实例
- ✅ 提供 `expressHandler` 和 `koaHandler`
- ✅ 接收 `im.message.receive_v1` 事件
- ✅ 支持自动 challenge 验证
- ✅ Handlers 通过 `FeishuChannelHandler` 暴露
- 🔲 需要用户自己配置 HTTP 服务器

**使用场景：**
```javascript
// Express
import express from "express";
import feishuPlugin from "feishu-hybrid-plugin";

const app = express();

const plugin = await feishuPlugin.register(config, {
  registerTool: (tool) => {},
  registerChannel: (channelId, handler) => {
    if (channelId === "openclaw-feishu-plus") {
      app.use("/webhook/feishu", handler.expressHandler);
    }
  },
  inboundBridge: inboundBridge  // OpenClaw 实现
});

app.listen(3000);
```

```javascript
// Koa
import Koa from "koa";
import feishuPlugin from "feishu-hybrid-plugin";

const app = new Koa();

const plugin = await feishuPlugin.register(config, {
  registerTool: (tool) => {},
  registerChannel: (channelId, handler) => {
    if (channelId === "openclaw-feishu-plus") {
      app.use(handler.koaHandler);
    }
  },
  inboundBridge: inboundBridge  // OpenClaw 实现
});

app.listen(3000);
```

### 消息处理流程

```
飞书事件 → Channel → handleIncomingMessage()
                        ↓
              1. 过滤机器人消息
              2. 解析消息类型
              3. 构造 FeishuInboundMessage 结构化对象
              4. 通过 InboundMessageBridge 注入（如果 OpenClaw 提供）
              5. 否则回退到日志记录（当前默认行为）
```

**重要说明**:
- ✅ 消息已结构化为 `FeishuInboundMessage` 对象
- ✅ `InboundMessageBridge` 接口已定义
- ✅ `FeishuChannelHandler` 接口已暴露
- ✅ `sendMessage` 接口已暴露（OpenClaw 可调用）
- 🔲 等待 OpenClaw 提供 `InboundMessageBridge` 实现
- 🔲 等待 OpenClaw 调用 `channel.sendMessage`
- 🔲 当前行为：消息只记录日志，未真正注入到 OpenClaw

详见 `CLOSURE_STATUS.md` 了解详细的闭环状态。

## 使用示例

### 创建文档（无需用户授权）

```
User: 帮我创建一个飞书文档叫"本周计划"

Assistant: 已成功创建飞书文档《本周计划》
文档 ID: doxcnxxxxxxxxxxxx
```

### 查询日历（优先用户 token）

```
User: 查看我明天的日程

Assistant: 明天您有 3 个会议：
1. 09:00 - 周会
2. 14:00 - 产品评审
3. 16:30 - 1v1
```

### 列出云盘文件

```
User: 列出我云盘根目录的文件

Assistant: 您的云盘根目录有以下文件：
1. 产品需求.docx
2. Q4 报告.xlsx
3. 项目资源/
```

### 创建多维表格记录

```
User: 在表格 "任务跟踪" 中添加一条记录

Assistant: 请提供以下信息：
- 表格 ID
- 记录字段数据
```

### 发送群聊消息

```
User: 向群聊 "产品讨论组" 发送一条消息

Assistant: 已发送消息到群聊
消息 ID: om_xxxxxxxxxxxxxx
```

### 用户授权流程

```
User: 我需要查询我的忙闲状态

Agent: 查询忙闲状态需要用户身份授权。
请点击以下链接完成授权：
https://open.feishu.cn/open-apis/authen/v1/authorize?...

授权完成后，请将回调中的授权码粘贴给我。

User: 授权完成了，授权码是 xxxxxxxx

Agent: 授权成功！现在可以查询您的忙闲状态了。
```

### Channel 监听消息（full 模式）

```
# 在飞书群聊中 @机器人
用户: @机器人 帮我查询明天的日程

机器人（OpenClaw）: 明天您有 3 个会议...
```

## 架构设计

### 核心概念

```
┌─────────────────────────────────────────────────────────┐
│                   OpenClaw Plugin API                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Plugin Context                        │
│  ├─ TokenResolver (Token-first Identity Resolver)      │
│  ├─ TokenStore (User Token 持久化)                      │
│  ├─ RequestExecutor (统一请求执行器)                     │
│  ├─ API Policy Registry (接口 Token 策略注册表)         │
│  └─ Channel (WebSocket/Webhook 监听)                   │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌────────────────┐      ┌────────────────┐
│  Doc Tools    │      │ Calendar Tools │
│  Wiki Tools   │      │ Drive Tools    │
│  Bitable Tools│      │ Task Tools     │
│  Chat Tools   │      │ Perm Tools     │
│  OAuth Tools  │      │ ...            │
└────────────────┘      └────────────────┘
```

### Token 解析策略

```text
Operation: "calendar.freebusy.list"
Policy: user_only

步骤 1: 查询 API policy
  → support = user_only

步骤 2: 检查用户授权状态
  → 无 user_access_token

步骤 3: 触发授权流程
  → 用户完成授权

步骤 4: 使用 user_access_token 调用 API
```

### Channel 架构

```
┌─────────────────────────────────────────────────────────┐
│                      Channel Layer                       │
│  ┌──────────────────┐          ┌──────────────────┐     │
│  │  WebSocket Mode  │          │   Webhook Mode   │     │
│  │  - WSClient      │          │  - EventDispatcher│    │
│  │  - Auto Reconnect│          │  - Express Handler│    │
│  │  - Real-time     │          │  - Koa Handler    │    │
│  └────────┬─────────┘          └────────┬─────────┘     │
│           │                              │             │
│           └──────────────┬───────────────┘             │
│                          ▼                             │
│              handleIncomingMessage()                    │
│                          │                             │
│                          ▼                             │
│         1. 过滤机器人消息                               │
│         2. 解析消息类型                                 │
│         3. 构造 FeishuInboundMessage                   │
│         4. 通过 InboundMessageBridge 注入（如果可用）   │
│         5. 否则记录日志（当前默认行为）                  │
└─────────────────────────────────────────────────────────┘
```

**当前状态**:
- ✅ `FeishuInboundMessage` 对象结构已定义
- ✅ `InboundMessageBridge` 接口已定义
- ✅ Channel 收到消息后会构造规范化的消息对象
- 🔲 等待 OpenClaw 提供 `InboundMessageBridge` 实现
- 🔲 当前行为：消息只记录日志

## 开发指南

### 目录结构

```
feishu-hybrid-plugin/
├── src/
│   ├── core/
│   │   ├── config-schema.ts      # 配置 Schema（zod）
│   │   ├── client.ts             # Lark SDK 客户端工厂
│   │   ├── token-store.ts        # User Token 持久化
│   │   ├── token-resolver.ts     # Token 解析器
│   │   ├── request-executor.ts   # 统一请求执行器
│   │   └── api-policy.ts         # 接口 Token 策略
│   ├── tools/
│   │   ├── doc.ts                # 文档工具
│   │   ├── calendar.ts           # 日历工具
│   │   ├── oauth-tool.ts         # OAuth 授权工具
│   │   ├── wiki.ts               # 知识库工具
│   │   ├── drive.ts              # 云盘工具
│   │   ├── bitable.ts            # 多维表格工具
│   │   ├── task.ts               # 任务工具
│   │   ├── chat.ts               # 群聊工具
│   │   └── perm.ts               # 权限管理工具
│   └── channel/
│       ├── plugin.ts             # Channel 辅助逻辑
│       └── onboarding.ts         # 配对引导
├── index.ts                       # 插件入口
├── package.json
├── tsconfig.json
└── openclaw.plugin.json          # 插件元数据
```

### 添加新工具

1. 在 `src/tools/` 下创建新文件（如 `mytool.ts`）
2. 定义工具 Schema 和执行器
3. 在 `index.ts` 中注册工具

示例：

```typescript
// src/tools/mytool.ts
export const MY_TOOL_DEFS = [
  {
    name: "feishu_mytool_action",
    description: "描述",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "参数1" },
      },
      required: ["param1"],
    },
  },
];

export class MyTools {
  constructor(
    private config: PluginConfig,
    private tokenStore: ITokenStore
  ) {}

  async execute(toolName: string, params: Record<string, unknown>, userId?: string) {
    switch (toolName) {
      case "feishu_mytool_action":
        return this.action(params, userId);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async action(params: Record<string, unknown>, userId?: string) {
    return executeFeishuRequest({
      operation: "api.path.action",
      userId,
      invoke: async ({ authorizationHeader }) => {
        const resp = await fetch(url, {
          headers: { "Authorization": authorizationHeader },
        });
        return resp.json();
      },
    });
  }
}

export function registerMyTools(
  tools: MyTools,
  registerTool: (toolDef: typeof MY_TOOL_DEFS[0], execute: (args: any) => Promise<any>) => void
): void {
  MY_TOOL_DEFS.forEach((toolDef) => {
    registerTool(toolDef, (args) => tools.execute(toolDef.name, args));
  });
}
```

然后在 `index.ts` 中：

```typescript
import { MyTools, registerMyTools } from "./src/tools/mytool.js";

// 在 initPlugin 中
const myTools = new MyTools(config, tokenStore);

// 在 registerTools 中
if (config.tools.mytool) {
  registerMyTools(myTools, (toolDef, execute) => {
    registerTool({
      name: toolDef.name,
      description: toolDef.description,
      parameters: toolDef.parameters,
      execute,
    });
  });
}
```

### 配置新接口的 Token 策略

在 `src/core/api-policy.ts` 中添加：

```typescript
apiPolicies.set("api.path.action", {
  support: "user_only", // 或 "tenant_only" 或 "both"
  description: "接口描述",
});
```

## 故障排查

### Channel 连接失败

**问题**: WebSocket 连接失败

**解决**:
1. 检查网络连接
2. 确认飞书开放平台已启用事件订阅
3. 查看日志中的错误信息

**问题**: Webhook 未收到回调

**解决**:
1. 确认 HTTP 服务器可公开访问
2. 检查飞书开放平台的 Webhook URL 配置
3. 验证 Challenge 请求是否正确响应

### 授权相关

**问题**: 无法获取 user_access_token

**解决**:
1. 检查 `redirectUri` 配置是否正确
2. 确认飞书应用已启用「用户身份验证」权限
3. 检查授权回调处理是否正确

**问题**: Token 过期

**解决**:
- 插件会自动刷新 tenant_access_token
- user_access_token 过期后需要重新授权

## 许可证

MIT
