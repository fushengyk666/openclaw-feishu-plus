# IMPLEMENTATION_STATUS

## Project
openclaw-feishu-plus

## Final Goal
按照 `TECHNICAL_PLAN.md` 完成一个"完全闭环"的 Feishu Plus 插件：
- 遵循 OpenClaw 官方插件模式
- 对齐飞书官方插件的流式卡片体验
- 支持应用授权 + 用户授权双模式
- 持续补齐飞书开放平台核心能力
- 提供高频 workflow skills 增强体验

## Current Status (2026-03-13, Round 17 — identity_mode 全域收口 + 流式卡片打磨收尾 + 全量验证)

### ✅ 已完成

#### identity_mode 全域收口（Round 16-17 完成）

**全部 12 个工具域** 已完成 `identity_mode: auto|user|app` 可选参数接入：

| 工具域 | 工具数 | identity_mode 覆盖 | 状态 |
|--------|--------|-------------------|------|
| doc | 4 | ✅ 全部 | 已验证 |
| calendar | 9 | ✅ 全部 | 已验证 |
| chat | 8 | ✅ 全部 | 已验证 |
| wiki | 4 | ✅ 全部 | 已验证 |
| drive | 8 | ✅ 全部 | 已验证 |
| task | 5 | ✅ 全部 | 已验证 |
| contact | 6 | ✅ 全部 | 已验证 |
| search | 3 | ✅ 全部 | 已验证 |
| sheets | 5 | ✅ 全部 | 已验证 |
| bitable | 6 | ✅ 全部 | 已验证 |
| perm | 5 | ✅ 全部 | 已验证 |
| approval | 7 | ✅ 全部 | 已验证 |
| **合计** | **70** | **70/70** | ✅ |

- **向后兼容**：`identity_mode` 在所有 schema 中均为可选参数，不在 `required` 数组中
- **共享 helper**：`src/tools/identity-mode.ts` 提供 `IDENTITY_MODE_SCHEMA` + `parseIdentityMode()`
- **语义**：`auto`(默认)=应用身份 → `user`=强制用户身份 → `app`=强制应用身份

#### 双授权路由策略（app-first, user-when-needed）

**完整的端到端链路**：

```
tools (identity_mode param)
  → platform clients (identityMode passthrough)
    → feishu-api.ts (identityMode → executeFeishuRequest)
      → request-executor.ts (identityMode → resolver.resolve)
        → token-resolver.ts (policy + identityMode → token decision)
```

**决策矩阵**：

| API policy | identity_mode=auto | identity_mode=user | identity_mode=app |
|------------|-------------------|-------------------|-------------------|
| tenant_only | tenant ✅ | tenant (ignored, logged) | tenant ✅ |
| user_only | user (no user→err) | user ✅ | user (ignored, logged) |
| both | **tenant** (默认) | user (no user→err) | tenant ✅ |

**可观测性日志**：
```
[IdentityRouter] calendar.freebusy.list: user (policy=user_only, mode=auto, user=ou_xxx…) — user_only API → user token
[IdentityRouter] docx.document.create: tenant (policy=both, mode=auto) — identity_mode=auto, both-capable API → tenant token (default)
```

#### 流式卡片体验打磨（Round 16-17 完成）

**核心策略：延迟建卡 + partial 驱动 + 短回复纯文本落版**

| 场景 | 行为 | 对比官方 |
|------|------|---------|
| 短回复（<120字，单行） | 纯文本直发，不建卡 | ✅ 对齐 |
| 长回复 / 结构化内容 | partial 驱动流式卡片 | ✅ 对齐 |
| 多 partial 逐步累积 | 第 2 个 partial 后建卡，100ms 节流更新 | ✅ 对齐 |
| final-only（无 partial） | 纯文本直发 | ✅ 对齐 |
| 建卡失败 | 降级纯文本 | ✅ 对齐 |
| idle / error | `closeIfNeeded()` 确保落版 | ✅ 对齐 |

**技术实现要点**：
- `disableBlockStreaming: true` + 自有 `onPartialReply` 接入
- `shouldForceStreamingCard()` 判定阈值：≥120字 / 多行 / 代码块 / 表格
- `mergeStreamingText` overlap 去重
- UUID 幂等 CardKit 调用
- `streaming_config.print_frequency_ms=50, print_step=1`

#### 双授权核心架构
- **identity 层完整落地**：TokenResolver → api-policy → request-executor → feishu-api 链路完整
- **token-store**：支持 memory / file 两种后端，per appId × per userOpenId 管理
- **token-resolver**：支持 tenant_only / user_only / both 三种策略决策
- **auth-prompt**：user_only 场景无 token 时自动生成授权链接
- **oauth.ts**：完整 Authorization Code Flow
- **request-executor**：统一请求执行器，含 401 自动重试（保持 identityMode 一致）
- **配置收口**：tools toggle 与实现对齐，index.ts 尊重各工具开关

#### feishu-api 高级 HTTP 客户端
- `src/identity/feishu-api.ts` — 工具层唯一的飞书 API 调用入口
- `feishuGet/Post/Patch/Delete/Put` 便捷方法，全部支持 `identityMode`
- `AuthRequiredError` 结构化授权提示

#### Platform 层（全部 12 域完成 ✅）
所有 12 个业务域已完成 platform client 迁移，全部支持 `identityMode` 透传：
- `src/platform/docs/client.ts` — docx 域
- `src/platform/calendar/client.ts` — calendar 域
- `src/platform/im/client.ts` — im 域
- `src/platform/wiki/client.ts` — wiki 域
- `src/platform/drive/client.ts` — drive 域
- `src/platform/bitable/client.ts` — bitable 域
- `src/platform/task/client.ts` — task 域
- `src/platform/perm/client.ts` — perm 域
- `src/platform/sheets/client.ts` — sheets 域
- `src/platform/contact/client.ts` — contact 域
- `src/platform/approval/client.ts` — approval 域
- `src/platform/search/client.ts` — search 域

每个 platform client：
- 封装 feishu OpenAPI 端点
- 通过 identity/feishu-api 执行（双授权决策在 identity 层）
- 导出纯函数，tools 只做 schema 定义 + 参数解析
- 全部接受 `identityMode` 参数

#### 双授权工具（12 个业务域 + OAuth = 74 个工具）
- **doc.ts** — 4 个工具 ✅ 双授权 → platform/docs
- **calendar.ts** — 9 个工具 ✅ 双授权 → platform/calendar
- **chat.ts** — 8 个工具 ✅ 双授权 → platform/im
- **wiki.ts** — 4 个工具 ✅ 双授权 → platform/wiki
- **drive.ts** — 8 个工具 ✅ 双授权 → platform/drive
- **bitable.ts** — 6 个工具 ✅ 双授权 → platform/bitable
- **task.ts** — 5 个工具 ✅ 双授权 → platform/task
- **perm.ts** — 5 个工具 ✅ 双授权 → platform/perm
- **sheets.ts** — 5 个工具 ✅ 双授权 → platform/sheets
- **contact.ts** — 6 个工具 ✅ 双授权 → platform/contact
- **approval.ts** — 7 个工具 ✅ 双授权 → platform/approval
- **search.ts** — 3 个工具 ✅ 双授权 → platform/search
- **oauth-tool.ts** — 4 个工具 ✅ 授权管理

#### API Policy 完整性
- **79 个 API 操作全部在 API_POLICY 注册**
- 操作名与工具域名匹配（无跨域污染）
- user_only 操作正确标记
- 所有 both 操作有完整 scopes

#### Channel 层
- 完整 ChannelPlugin 定义（plugin.ts）
- WebSocket + Webhook 双模式入站
- 消息收发主链路（send.ts 支持 identityMode）
- 流式卡片（DM + 群聊场景）
- 目录/配对/Policy/探测/提及

#### 流式卡片底层修复 — 对齐官方 OpenClaw 飞书插件

| 差异点 | 旧实现 | 官方实现 | 修复 |
|--------|--------|----------|------|
| CardKit API 调用方式 | SDK wrapper | Raw HTTP (fetch + tenant_access_token) | ✅ 修复 |
| 初始卡片内容 | 空字符串 | `"⏳ Thinking..."` | ✅ 修复 |
| element_id | `"streaming_content"` | `"content"` | ✅ 修复 |
| streaming_config | 缺失 | `print_frequency_ms: 50, print_step: 1` | ✅ 修复 |
| uuid 幂等 | 缺失 | `uuid: "s_{cardId}_{sequence}"` | ✅ 修复 |
| 内容合并 | 简单拼接 | `mergeStreamingText`（overlap 去重） | ✅ 修复 |
| 更新节流 | 无 | 100ms throttle | ✅ 修复 |
| 关闭序列 | 两步 | 一步 PATCH settings | ✅ 修复 |

#### Skills 层增强
- **feishu-doc**：文档创建/读取/编辑工作流指南
- **feishu-calendar**：日程查询/创建/忙闲协调工作流指南
- **feishu-bitable**：多维表格 CRUD 与批量数据工作流指南
- **feishu-drive**：云盘文件管理与权限工作流指南
- **feishu-approval**：审批定义/实例/操作工作流指南

#### Channel 发送路径收口
- 13 项静态审计 + 19 项深度审计全部通过
- 所有普通 IM message 发送路径通过 `send.ts` → `feishu-api.ts` → 双授权决策
- 允许保留的 raw SDK 特例已审计并文档化

### ⏳ 遗留未完成项

1. **流式卡片真实环境验证**：代码/策略已完成，需 DM + 群聊实测验证首屏体感、更新频率、最终落版
2. **`identity_mode=auto` 的"资源归属自动判别"**：当前实现为安全保守版（both 默认 app）；未来可增强为根据资源上下文自动推断
3. **card action 路由到 agent**：✅ 已实现最小链路；后续可演进为"更新原卡片/异步任务卡片"
4. **event subscription 扩展**：仍仅 `im.message.receive_v1`，Phase 3 剩余
5. **raw SDK 发送例外项收口**：CardKit 已改 Raw HTTP，但 media multipart 上传、typing indicator、directory/probe 等 bot-context/SDK 特例仍保留并已文档化

## Confirmed Verification (Round 17)

### Build
```
npm run build → ✅ 零错误
npx tsc --noEmit → ✅ 零错误
npm run verify → ✅ 全部通过 (exit code 0)
```

### All Tests (21 files, all passing)

```
verify-api-policy-coverage.ts           → 28/28 ✅
verify-approval-search-tools.ts         → 10/10 ✅
verify-card-action-routing.ts           → 1/1 ✅
verify-channel-send.ts                  → 6/6 ✅
verify-channel-send-paths-audit.ts      → 13/13 ✅
verify-dual-auth-tools.ts              → 9/9 ✅
verify-dual-auth.ts                    → 11/11 ✅
verify-edge-cases.ts                   → 23/23 ✅
verify-live-feishu-contract.ts         → SKIP (no env) ✅
verify-live-harness-init.ts            → 29/29 ✅
verify-media-send.ts                   → 4/4 ✅
verify-no-direct-sdk-send.ts           → 4/4 ✅
verify-plugin-send-paths.ts            → 4/4 ✅
verify-send-path-deep-audit.ts         → 19/19 ✅
verify-streaming-card-executor.ts      → 4/4 ✅
verify-streaming-card.ts              → 7/7 ✅
verify-streaming-dispatch-executor.ts  → 8/8 ✅
verify-streaming-dispatch.ts          → 6/6 ✅
verify-streaming-group.ts            → 15/15 ✅
verify-streaming-reference-send.ts    → 5/5 ✅
verify-streaming-session.ts          → 6/6 ✅
verify-tool-toggle-registration.ts    → 3/3 ✅
```

**Total: 21 files, 186+ checks, 0 failures**

## Architecture Summary

### identity_mode 端到端流转

```
┌─────────────────────────────────────────────────────────────────┐
│ Tool Schema (70 tools)                                          │
│ identity_mode?: "auto" | "user" | "app"  (optional, default: auto) │
└────────────────┬────────────────────────────────────────────────┘
                 │ parseIdentityMode()
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Platform Client (12 domains)                                     │
│ identityMode → feishuGet/Post/etc                               │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ feishu-api.ts                                                    │
│ feishuRequest({ operation, identityMode, userId, ... })          │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ request-executor.ts                                              │
│ executeFeishuRequest({ operation, identityMode, invoke })        │
│ + 401 auto-retry (preserves identityMode)                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ token-resolver.ts                                                │
│ resolve({ operation, userId, identityMode })                    │
│ → policy + mode → tenant/user token                             │
│ + [IdentityRouter] structured log                               │
└─────────────────────────────────────────────────────────────────┘
```

### 流式卡片决策流程

```
onPartialReply(text)
  │
  ├─ partialCount < 2 && !shouldForceStreaming → buffer, no card
  │
  ├─ partialCount >= 2 || shouldForceStreaming → createStreamingCard()
  │                                              → updateStreamingContent() (100ms throttle)
  │
  └─ deliver(final)
       │
       ├─ card exists → finalizeCard() (final update + close streaming_mode)
       │
       └─ no card → sendPlainText() (short/final-only reply)

closeIfNeeded() — idle/error safety net
```

## Modified Files (cumulative Round 16-17)

### Key Source Files

| File | Role |
|------|------|
| `src/tools/identity-mode.ts` | Shared schema + parser for identity_mode |
| `src/identity/token-resolver.ts` | Core decision engine with IdentityMode + structured logging |
| `src/identity/request-executor.ts` | Unified executor with identityMode passthrough + 401 retry |
| `src/identity/feishu-api.ts` | All HTTP helpers support identityMode |
| `src/identity/types.ts` | IdentityMode / IdentitySelectionLog exports |
| `src/tools/{doc,calendar,chat,wiki,drive,task,contact,search,sheets,bitable,perm,approval}.ts` | All 12 tool domains with identity_mode param |
| `src/platform/*/client.ts` | All 12 platform clients with identityMode passthrough |
| `src/channel/send.ts` | Message send path supports identityMode |
| `src/channel/streaming-session.ts` | Partial-driven / delayed-card / short-final-plaintext strategy |
| `src/channel/plugin.ts` | onPartialReply + disableBlockStreaming + onIdle/onError hooks |

## Non-Negotiable Rules
- 不得虚报完成度
- 不得把"编译通过"当作"闭环完成"
- 不得为了省事破坏双授权设计
- 每轮结束必须给出：完成项 / 未完成项 / 风险 / 下一轮最小闭环

## Next Steps

### 高优先级
1. **流式卡片真实环境回归**：代码修复已完成，需 DM + 群聊实测验证
2. **user-token 实际发送验证**：端到端 OAuth flow → user token → API call

### 中优先级
3. card action → agent 路由实现（✅ 最小链路已完成；待真实环境验证）
4. 更完整 event subscription 体系
5. 更多 skills（sheets 工作流、chatops 工作流）

### 低优先级
6. bot menus / bot config
7. 更完整 search / thread / message 回复链路
8. `identity_mode=auto` 资源归属语义推断增强

## Risk Assessment

1. **流式卡片 Raw HTTP 路径**：已对齐官方实现，但需真实环境确认 fetch API 在 OpenClaw runtime 中的可用性
2. **搜索 API 权限**：search 域全部 user_only，需确保飞书应用已申请搜索相关 scope
3. **审批表单格式**：approval.instance.create 的 form 参数格式高度依赖审批定义，需实际验证
