# OpenClaw Feishu Plus

飞书增强插件 —— 在 OpenClaw 官方 channel 插件模式下，提供 **Dual-Token 自动切换**（user-if-available-else-tenant）、完整飞书 channel 接入、以及已接入双授权链路的高频飞书工具集。

## 当前状态

**已完成的核心闭环：**
- channel 外壳、pairing、directory、onboarding、gateway、probe
- WebSocket / Webhook 双模式入站
- doc / calendar / chat / wiki / drive / bitable / task / perm / sheets / contact / approval / search / oauth 工具注册
- 上述工具全部接入 `feishuRequest -> executeFeishuRequest -> TokenResolver` 双授权决策链路
- DM + 群聊流式卡片主链路（StreamingSession 封装）
- 高频 workflow skills（doc / calendar / bitable / drive / approval）
- 本地 mock / contract smoke tests 全面覆盖（21 个测试文件，186+ 项检查）

**仍未完全闭环的部分：**
- 真实飞书环境端到端验证
- 流式卡片真实环境稳定性
- 更多高级事件订阅与 card action 能力

更细状态请看：
- `IMPLEMENTATION_STATUS.md`
- `CLOSURE_STATUS.md`
- `TECHNICAL_PLAN.md`

## 核心特性

- **Dual-Token 自动切换**：有 user_access_token 就优先走用户身份，没有就回退 tenant_access_token
- **完整 Channel 集成**：pairing、directory、messaging、onboarding、policy、gateway、probe
- **12 个飞书工具域**：doc、calendar、chat、wiki、drive、bitable、task、perm、sheets、contact、approval、search + oauth 授权管理
- **流式卡片**：DM + 群聊场景，StreamingSession 封装（thinking / generating / complete）
- **高频 Workflow Skills**：doc、calendar、bitable、drive、approval 工作流增强
- **独立命名空间**：不影响其他已安装的飞书插件

## 安装

```bash
# 从本地路径安装
openclaw plugins install /path/to/openclaw-feishu-plus

# 或从 npm 安装（发布后）
openclaw plugins install openclaw-feishu-plus
```

## 配置

在 `openclaw.json` 中添加：

```json
{
  "channels": {
    "openclaw-feishu-plus": {
      "enabled": true,
      "appId": "cli_xxx",
      "appSecret": "xxx",
      "domain": "feishu",
      "connectionMode": "websocket",
      "dmPolicy": "open",
      "groupPolicy": "disabled",
      "streaming": true,
      "streamingInGroup": false,
      "auth": {
        "preferUserToken": true,
        "autoPromptUserAuth": true,
        "store": "file",
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
        "perm": true,
        "sheets": true,
        "contact": true,
        "approval": false,
        "search": false
      }
    }
  }
}
```

### 常用配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | true | 是否启用 |
| `appId` | string | — | 飞书应用 App ID |
| `appSecret` | string | — | 飞书应用 App Secret |
| `domain` | string | feishu | `feishu` 或 `lark` |
| `connectionMode` | string | websocket | `websocket` 或 `webhook` |
| `dmPolicy` | string | open | `open` / `pairing` / `allowlist` |
| `groupPolicy` | string | disabled | `open` / `allowlist` / `disabled` |
| `requireMention` | boolean | true | 群聊中是否需要 @机器人 |
| `streaming` | boolean | false | 是否启用流式卡片 |
| `streamingInGroup` | boolean | false | 群聊是否启用流式卡片 |
| `auth.preferUserToken` | boolean | true | 有用户授权时是否优先使用 user token |
| `auth.autoPromptUserAuth` | boolean | true | 遇到 user_only 场景时是否提示用户授权 |
| `auth.store` | string | file | token 存储后端（`file` / `memory`） |
| `auth.redirectUri` | string | — | OAuth 回调地址 |
| `tools.*` | boolean | 各异 | 是否启用对应工具域 |

### 工具域开关默认值

| 工具域 | 默认 | 说明 |
|--------|------|------|
| doc / calendar / chat / wiki / drive / bitable / task / perm / sheets / contact / oauth | ✅ true | 核心工具默认启用 |
| approval / search | ❌ false | 高级工具默认禁用（需手动启用） |

### Webhook 模式额外配置

```json
{
  "connectionMode": "webhook",
  "webhookHost": "0.0.0.0",
  "webhookPort": 3000,
  "webhookPath": "/webhook/feishu-plus"
}
```

## Dual-Token 设计

本插件的核心价值：**同一个 API，运行时自动选择最合适的身份**。

### 策略：Prefer User, Fallback App

1. 如果用户已授权且有有效的 `user_access_token` → 使用用户身份
2. 否则 → 回退到 `tenant_access_token`（应用身份）
3. 对于 `user_only` 接口 → 无用户授权时返回授权提示

### 与其他方案的区别

| 特性 | OpenClaw 官方 feishu 扩展 | 本插件 |
|------|--------------------------|--------|
| Token 策略 | 以 tenant token 为主 | 自动切换 user / tenant |
| 工具能力扩展 | 基础 channel 能力 | 12 个飞书业务域 + 5 个 workflow skills |
| 双授权工具链路 | 非项目目标 | 79 个 API 操作全部接入双授权链路 |
| 流式卡片 | 官方风格参考 | DM + 群聊，StreamingSession 封装 |

## 工具列表（当前注册名）

### 文档（Doc）
- `feishu_plus_doc_create`
- `feishu_plus_doc_get`
- `feishu_plus_doc_list_blocks`
- `feishu_plus_doc_raw_content`

### 日历（Calendar）
- `feishu_plus_calendar_list` / `create` / `delete` / `update`
- `feishu_plus_calendar_event_list` / `create` / `update` / `delete`
- `feishu_plus_calendar_freebusy` *(user_only)*

### 群聊 / 消息（Chat / IM）
- `feishu_plus_chat_list` / `chat_get`
- `feishu_plus_message_send` / `list` / `reply` / `delete` / `forward` / `get`

### Wiki
- `feishu_plus_wiki_list_spaces` / `get_node` / `list_nodes` / `create_space`

### 云盘（Drive）
- `feishu_plus_drive_list_files` / `get_file` / `download_file` / `upload_file`
- `feishu_plus_drive_create_folder` / `delete_file` / `copy_file` / `move_file`

### 多维表格（Bitable）
- `feishu_plus_bitable_get_app` / `list_tables`
- `feishu_plus_bitable_list_records` / `create_record` / `update_record` / `delete_record`

### 任务（Task）
- `feishu_plus_task_get` / `list` / `create` / `update` / `complete`

### 权限（Permission）
- `feishu_plus_drive_list_permissions` / `create_permission` / `update_permission` / `delete_permission`
- `feishu_plus_drive_transfer_owner` *(user_only)*

### 电子表格（Sheets）
- `feishu_plus_sheets_get` / `create` / `query` / `find` / `list`

### 通讯录（Contact）
- `feishu_plus_contact_user_get` / `user_batch_get` / `user_me` *(user_only)*
- `feishu_plus_contact_department_get` / `department_list_children` / `department_list_users`

### 审批（Approval）
- `feishu_plus_approval_get_definition` / `list_instances` / `get_instance`
- `feishu_plus_approval_create_instance` / `approve` / `reject` / `cancel` *(user_only)*

### 搜索（Search）
- `feishu_plus_search_message` / `search_doc` / `search_app` *(all user_only)*

### OAuth
- `feishu_plus_auth_status` / `authorize` / `callback` / `revoke`

## Skills

本插件提供 5 个高频 workflow skills，位于 `skills/` 目录：

| Skill | 说明 |
|-------|------|
| feishu-doc | 文档创建/读取/编辑工作流 |
| feishu-calendar | 日程查询/创建/忙闲协调工作流 |
| feishu-bitable | 多维表格 CRUD 与批量数据工作流 |
| feishu-drive | 云盘文件管理与权限工作流 |
| feishu-approval | 审批定义/实例/操作工作流 |

## 开发与验证

```bash
npm install
npm run build
npx tsc --noEmit
```

运行全部测试：

```bash
# 所有 21 个测试文件
for f in tests/verify-*.ts; do npx tsx "$f"; done
```

关键测试文件：

| 测试文件 | 检查项 | 说明 |
|----------|--------|------|
| verify-api-policy-coverage.ts | 28 | API Policy 完整性与域匹配 |
| verify-approval-search-tools.ts | 10 | 审批/搜索工具双授权契约 |
| verify-edge-cases.ts | 23 | 边界条件与回归防护 |
| verify-live-harness-init.ts | 29 | 初始化链路完整性 |
| verify-dual-auth-tools.ts | 9 | 所有工具域双授权路径 |
| verify-streaming-session.ts | 6 | StreamingSession 封装 |
| verify-streaming-group.ts | 15 | 群聊流式卡片 |
| verify-send-path-deep-audit.ts | 19 | 发送路径深度审计 |

真实飞书环境契约验证：

```bash
FEISHU_PLUS_APP_ID=cli_xxx \
FEISHU_PLUS_APP_SECRET=xxx \
npx tsx tests/verify-live-feishu-contract.ts
```

## 参考文档

- `TECHNICAL_PLAN.md` — 完整技术方案与目标边界
- `IMPLEMENTATION_STATUS.md` — 当前真实实现状态与下一步
- `CLOSURE_STATUS.md` — 分阶段完成度说明
- `INTEGRATION_GUIDE.md` — 接入指南

## License

MIT
