# openclaw_feishu_plus

飞书增强版 OpenClaw 插件 — 同一套接口，运行时按 Token 类型自动选择身份。

## 核心设计

- **Token-first 架构**：身份由 `Authorization` header 的 token 类型决定
- **默认策略**：`user-if-available-else-tenant`
  - 有 `user_access_token` → 用户身份
  - 没有 → 回退 `tenant_access_token`（应用身份）
- **接口限制优先**：少数接口明确只支持某种 token 时，强制使用对应身份
- **插件共存**：独立 plugin id / channel id / config namespace，不影响其他插件

## 安装

```bash
# 克隆后安装依赖
npm install

# 编译
npm run build
```

## 配置

```jsonc
// openclaw.json
{
  "channels": {
    "openclaw_feishu_plus": {
      "enabled": true,
      "mode": "full",          // "full" 或 "tools-only"
      "appId": "cli_xxx",
      "appSecret": "xxx",
      "domain": "feishu",      // "feishu" 或 "lark"
      "connectionMode": "websocket",
      "auth": {
        "preferUserToken": true,
        "autoPromptUserAuth": true,
        "store": "keychain-first"
      },
      "tools": {
        "doc": true,
        "wiki": true,
        "drive": true,
        "bitable": true,
        "calendar": true,
        "task": true,
        "chat": true,
        "perm": true
      }
    }
  }
}
```

## 架构

```
index.ts                    ← 唯一插件入口
src/
  constants.ts              ← PLUGIN_ID / CHANNEL_ID / CONFIG_NAMESPACE
  core/
    config-schema.ts        ← 配置 Schema (zod)
    client.ts               ← Lark SDK 客户端工厂
    api-policy.ts           ← API Policy Registry (operation → token support)
    token-store.ts          ← UAT 持久化存储
    token-resolver.ts       ← ★ 核心：Token-first Identity Resolver
    request-executor.ts     ← 统一请求执行器
    oauth.ts                ← OAuth Authorization Code Flow
  tools/
    doc.ts                  ← 文档工具
    calendar.ts             ← 日历工具
    oauth-tool.ts           ← 授权管理工具
    wiki.ts / drive.ts / bitable.ts / task.ts / chat.ts / perm.ts
  channel/
    plugin.ts               ← Channel 辅助逻辑
    onboarding.ts           ← 配对引导
skills/
  feishu-doc/SKILL.md
  feishu-calendar/SKILL.md
```

## 开发状态

- ✅ 核心架构（TokenResolver / ApiPolicy / RequestExecutor / TokenStore）
- ✅ 最小闭环工具（doc / calendar / oauth）已有真实 API 调用
- ✅ 骨架工具（wiki / drive / bitable / task / chat / perm）结构就绪
- ✅ 编译通过
- 🔲 Channel WebSocket/Webhook 实现
- 🔲 完整 API 覆盖
- 🔲 集成测试

## License

MIT
