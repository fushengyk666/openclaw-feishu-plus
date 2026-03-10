# OpenClaw Feishu Plus

飞书增强插件 — 同一套接口，运行时按 Token 类型自动选择身份（user-if-available-else-tenant）。

## 核心特性

- **Dual-Token 自动切换**：有 user_access_token 就用用户身份，没有就回退 tenant_access_token
- **完整 Channel 集成**：pairing、directory、messaging、onboarding、security、gateway
- **全部工具能力**：doc、calendar、wiki、drive、bitable、task、chat、perm、oauth
- **独立命名空间**：不影响其他已安装的飞书插件

## 安装

```bash
# 从本地路径安装
openclaw plugins install /path/to/feishu-hybrid-plugin

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
      "groupPolicy": "disabled"
    }
  }
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | true | 是否启用 |
| `appId` | string | - | 飞书应用 App ID |
| `appSecret` | string | - | 飞书应用 App Secret |
| `domain` | string | "feishu" | "feishu" 或 "lark" |
| `connectionMode` | string | "websocket" | "websocket" 或 "webhook" |
| `dmPolicy` | string | "open" | "open" / "pairing" / "allowlist" |
| `groupPolicy` | string | "disabled" | "open" / "allowlist" / "disabled" |
| `allowFrom` | array | [] | 允许的用户 ID 列表 |
| `groupAllowFrom` | array | [] | 允许的群组 ID 列表 |
| `requireMention` | boolean | false | 群聊中是否需要 @机器人 |
| `historyLimit` | number | - | 历史消息限制 |
| `textChunkLimit` | number | - | 文本分块限制 |
| `mediaMaxMb` | number | - | 媒体文件大小限制 (MB) |

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

### 策略：user-if-available-else-tenant

1. 如果用户已授权且有有效的 `user_access_token` → 使用用户身份
2. 否则 → 回退到 `tenant_access_token`（应用身份）
3. 仅文档明确限制 token 类型的接口才强制单身份

### 与官方插件的区别

| 特性 | 飞书官方插件 | OpenClaw 官方扩展 | 本插件 |
|------|-------------|------------------|--------|
| Token 策略 | 以 UAT 为主 | 仅 TAT | 自动切换 |
| 安装方式 | npm install | 内置 | npm install |
| 独立性 | 可能影响其他插件 | 内置 | 完全独立 |
| Channel 集成 | 完整 | 完整 | 完整 |

## 工具列表

### 文档 (doc)
- `feishu_doc_create` — 创建云文档
- `feishu_doc_get` — 获取文档内容
- `feishu_doc_list_blocks` — 列出文档块

### 日历 (calendar)
- `feishu_calendar_list` — 列出日历
- `feishu_calendar_event_create` — 创建日程
- `feishu_calendar_event_list` — 列出日程

### Wiki
- `feishu_wiki_list_spaces` — 列出知识空间
- `feishu_wiki_get_node` — 获取节点
- `feishu_wiki_create_node` — 创建节点

### 云文档/Drive
- `feishu_drive_list_files` — 列出文件
- `feishu_drive_get_file_meta` — 获取文件元信息
- `feishu_drive_create_folder` — 创建文件夹

### 多维表格 (Bitable)
- `feishu_bitable_list_tables` — 列出数据表
- `feishu_bitable_list_records` — 列出记录
- `feishu_bitable_create_record` — 创建记录

### 任务 (Task)
- `feishu_task_create` — 创建任务
- `feishu_task_list` — 列出任务
- `feishu_task_update` — 更新任务

### 群聊 (Chat)
- `feishu_chat_list` — 列出群聊
- `feishu_chat_create` — 创建群聊
- `feishu_chat_get_info` — 获取群信息

### 权限 (Perm)
- `feishu_perm_get` — 获取权限
- `feishu_perm_create` — 创建权限
- `feishu_perm_delete` — 删除权限

### OAuth
- `feishu_auth_get_url` — 获取授权链接
- `feishu_auth_callback` — 处理授权回调
- `feishu_auth_status` — 查看授权状态

## 开发

```bash
npm install
npm run build
```

## License

MIT
