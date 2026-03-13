# OpenClaw Feishu Plus 集成指南

本文档说明如何把 `openclaw-feishu-plus` 作为 **OpenClaw channel plugin + tool bundle** 接入。

> 当前状态：
> - 12 个飞书业务域工具 + OAuth 管理工具，全部接入双授权链路
> - 飞书消息通道可运行（WebSocket / Webhook）
> - DM + 群聊流式卡片（StreamingSession 封装）
> - 5 个高频 workflow skills
> - 21 个测试文件、186+ 项检查全部通过

如需看完整完成度，参考 `CLOSURE_STATUS.md` 和 `IMPLEMENTATION_STATUS.md`。

---

## 1. 插件提供的能力

### 1.1 Channel 能力
- Feishu / Lark channel plugin
- pairing / directory / onboarding / policy / probe
- WebSocket / Webhook 双模式入站
- 文本回复 + 流式卡片

### 1.2 工具能力（12 个业务域 + OAuth）

| 域 | 工具数 | 双授权 | user_only 操作 |
|----|--------|--------|----------------|
| doc | 4 | ✅ | — |
| calendar | 9 | ✅ | freebusy |
| chat/message | 8 | ✅ | — |
| wiki | 4 | ✅ | — |
| drive | 8 | ✅ | — |
| bitable | 6 | ✅ | — |
| task | 5 | ✅ | — |
| perm | 5 | ✅ | transferOwner |
| sheets | 5 | ✅ | — |
| contact | 6 | ✅ | user.me |
| approval | 7 | ✅ | create/approve/reject/cancel |
| search | 3 | ✅ | 全部 user_only |
| oauth | 4 | — | 授权管理 |

### 1.3 Workflow Skills

| Skill | 路径 |
|-------|------|
| feishu-doc | `skills/feishu-doc/SKILL.md` |
| feishu-calendar | `skills/feishu-calendar/SKILL.md` |
| feishu-bitable | `skills/feishu-bitable/SKILL.md` |
| feishu-drive | `skills/feishu-drive/SKILL.md` |
| feishu-approval | `skills/feishu-approval/SKILL.md` |

---

## 2. 插件入口模式

本插件遵循 OpenClaw 插件模式：

```ts
// 插件导出默认对象
export default {
  id: "openclaw-feishu-plus",
  name: "Feishu Plus",
  register(api) {
    api.registerChannel({ plugin: feishuPlusPlugin });
    // 根据 tools toggle 注册工具
    // 初始化 identity 层（双授权）
  }
};
```

OpenClaw 在加载插件后调用 `register(api)`。

---

## 3. 配置

### 3.1 基础配置

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
        "chat": true,
        "wiki": true,
        "drive": true,
        "bitable": true,
        "task": true,
        "perm": true,
        "sheets": true,
        "contact": true,
        "approval": false,
        "search": false,
        "oauth": true
      }
    }
  }
}
```

### 3.2 工具开关说明

- 核心工具（doc/calendar/chat/wiki/drive/bitable/task/perm/sheets/contact/oauth）默认启用
- 高级工具（approval/search）默认禁用，需手动开启
- 设为 `false` 则不注册该域的任何工具

---

## 4. 双授权（Dual-Auth）集成

### 4.1 策略

```
Prefer User, Fallback App
```

- 有 user token → 优先 user
- 无 user token → 回退 tenant
- user_only 接口无 user token → 返回授权提示

### 4.2 API Policy 注册表

79 个飞书 API 操作在 `src/identity/api-policy.ts` 注册，每个声明：
- token 支持类型（`both` / `user_only` / `tenant_only`）
- 所需 OAuth scopes

### 4.3 工具层上下文

插件从 OpenClaw 工具执行上下文提取 userId：
- `ctx.senderId`
- `ctx.metadata.senderId`
- `ctx.From`（解析 `ou_xxx` 后缀）

---

## 5. 流式卡片

### 5.1 架构

```
StreamingSession（封装所有状态）
  → createStreamingCard（CardKit API）
  → updateStreamingContent
  → finalizeCard + streaming_mode=false
```

### 5.2 配置

- `streaming: true` — 启用 DM 流式卡片
- `streamingInGroup: true` — 额外启用群聊流式卡片

### 5.3 降级策略

- 流式卡片创建失败 → 自动降级为纯文本

---

## 6. 安装与验证

### 6.1 安装

```bash
openclaw plugins install /path/to/openclaw-feishu-plus
```

### 6.2 验证步骤

1. **插件加载**：确认 `registerChannel` / `registerTool` 被调用
2. **Channel 基础闭环**：WebSocket/Webhook 连通 → 收消息 → 回消息
3. **OAuth / user token**：生成授权链接 → 回调换 token → 工具切换 user/tenant
4. **工具域验证**：优先 doc → calendar → chat，然后其他
5. **流式卡片**：先 DM → 再群聊

### 6.3 测试

```bash
# 本地验证（无需凭证）
for f in tests/verify-*.ts; do npx tsx "$f"; done

# 真实飞书环境验证
FEISHU_PLUS_APP_ID=cli_xxx \
FEISHU_PLUS_APP_SECRET=xxx \
npx tsx tests/verify-live-feishu-contract.ts
```

---

## 7. 当前限制

1. **card action / callback** 尚未实现
2. **event subscription** 仅 `im.message.receive_v1`
3. **send.ts / outbound** channel 层发送仍直接用 Lark SDK
4. **platform 层拆分** 未按 TECHNICAL_PLAN.md 演进到独立 platform 层

---

## 8. 参考文档

- `README.md` — 使用说明与工具列表
- `IMPLEMENTATION_STATUS.md` — 真实实现状态
- `CLOSURE_STATUS.md` — 分阶段完成度
- `TECHNICAL_PLAN.md` — 完整技术方案
