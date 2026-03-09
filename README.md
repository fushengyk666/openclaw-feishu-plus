# OpenClaw Feishu Plus

飞书增强版 OpenClaw 插件 — 同一套接口，运行时按 Token 类型自动选择身份。

## 特性

- **Token-first 架构**：身份由 `Authorization` header 的 token 类型决定
- **默认策略**：`user-if-available-else-tenant`
  - 有 `user_access_token` → 用户身份
  - 没有 → 回退 `tenant_access_token`（应用身份）
- **接口限制优先**：少数接口明确只支持某种 token 时，强制使用对应身份
- **插件共存**：独立 plugin id / channel id / config namespace，不影响其他插件
- **安全默认**：默认 `tools-only` 模式，仅启用已实现的 MVP 工具

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

### 3. 配置 OpenClaw

在 `openclaw.json` 中添加以下配置：

```jsonc
{
  "channels": {
    "openclaw-feishu-plus": {
      "enabled": true,
      "mode": "tools-only",
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
        "wiki": false,
        "drive": false,
        "bitable": false,
        "task": false,
        "chat": false,
        "perm": false
      }
    }
  }
}
```

### 4. 重启 OpenClaw

```bash
# 重启 gateway
openclaw gateway restart
```

## 当前支持的能力

### ✅ 已实现（MVP）

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

### 🔲 骨架实现（默认禁用）

以下工具已定义接口但未实现实际 API 调用，需要手动在配置中启用：

- `feishu_wiki_*` - Wiki 知识库
- `feishu_drive_*` - 云盘
- `feishu_bitable_*` - 多维表格
- `feishu_task_*` - 任务
- `feishu_chat_*` - 群聊
- `feishu_perm_*` - 权限管理

**警告**：启用这些工具后调用会抛出错误。请在贡献完整实现后再启用。

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
│  └─ API Policy Registry (接口 Token 策略注册表)         │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌────────────────┐      ┌────────────────┐
│  Doc Tools    │      │ Calendar Tools │
│  Wiki Tools   │      │ Drive Tools    │
│  ...          │      │ ...            │
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
  → 返回结果
```

### 接口支持声明

每个飞书 Open API 都在 `api-policy.ts` 中声明其 token 支持情况：

```typescript
export const API_POLICY: Record<string, ApiPolicy> = {
  "docx.document.create": {
    support: "both",           // 支持两种 token
    userScopes: ["docx:document"],
    tenantScopes: ["docx:document"],
  },
  "calendar.freebusy.list": {
    support: "user_only",      // 仅支持用户 token
    userScopes: ["calendar:calendar:readonly"],
  },
};
```

## 配置说明

### 运行模式

| 模式 | 说明 | 推荐场景 |
|------|------|----------|
| `tools-only` | 仅注册工具，不注册 Channel | 默认模式，与其他插件共存 |
| `full` | 注册工具 + Channel | 需要 WebSocket/Webhook 接入时 |

**注意**：当前版本 Channel 尚未完整实现，请使用默认的 `tools-only` 模式。

### 身份策略

```json
{
  "auth": {
    "preferUserToken": true,           // 优先使用用户 token
    "autoPromptUserAuth": true,        // 自动提示授权
    "redirectUri": "https://open.feishu.cn/oauth/callback",
    "store": "file"                    // token 存储方式
  }
}
```

### 工具开关

```json
{
  "tools": {
    "doc": true,          // ✅ 已实现，默认启用
    "calendar": true,     // ✅ 已实现，默认启用
    "oauth": true,        // ✅ 已实现，默认启用

    "wiki": false,        // 🔲 骨架实现，默认禁用
    "drive": false,
    "bitable": false,
    "task": false,
    "chat": false,
    "perm": false
  }
}
```

## 开发

### 构建项目

```bash
npm run build
```

### 监听模式

```bash
npm run dev
```

### 目录结构

```
feishu-hybrid-plugin/
├── index.ts                 # 插件入口
├── src/
│   ├── constants.ts         # 全局常量
│   ├── core/
│   │   ├── config-schema.ts     # 配置 Schema
│   │   ├── api-policy.ts        # API Policy 注册表
│   │   ├── token-resolver.ts    # Token 解析器
│   │   ├── token-store.ts       # Token 持久化
│   │   ├── request-executor.ts  # 请求执行器
│   │   ├── oauth.ts             # OAuth 实现
│   │   └── client.ts            # Lark SDK 客户端
│   ├── tools/
│   │   ├── doc.ts           # 文档工具
│   │   ├── calendar.ts      # 日历工具
│   │   ├── oauth-tool.ts    # 授权管理工具
│   │   └── ...              # 其他工具
│   └── channel/
│       ├── plugin.ts        # Channel 辅助
│       └── onboarding.ts    # 配对引导
└── skills/
    └── feishu-*/            # Agent Skills
```

## 贡献

欢迎贡献新的工具能力！请遵循以下步骤：

1. 在 `src/tools/` 中创建新的工具文件
2. 在 `src/core/api-policy.ts` 中注册操作的 token 策略
3. 使用 `executeFeishuRequest` 进行 API 调用
4. 在 `index.ts` 中注册新工具
5. 更新 `src/core/config-schema.ts` 中的工具开关（默认禁用）
6. 更新本 README 文档

## 已知限制

- ⚠️ Channel WebSocket/Webhook 尚未实现，当前仅支持 tools-only 模式
- ⚠️ Wiki、Drive、Bitable 等工具仅为骨架，未实现实际 API 调用
- ⚠️ OAuth 回调需要手动输入授权码（无自动化 HTTP 端点）
- ⚠️ Token 刷新机制已实现但未充分测试

## License

MIT
