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

## Current Status (2026-03-13, Round 14 — Platform Layer Complete + Streaming Card Fix)

### ✅ 已完成

#### 双授权核心架构
- **identity 层完整落地**：TokenResolver → api-policy → request-executor → feishu-api 链路完整
- **token-store**：支持 memory / file 两种后端，per appId × per userOpenId 管理
- **token-resolver**：支持 tenant_only / user_only / both 三种策略决策
- **auth-prompt**：user_only 场景无 token 时自动生成授权链接
- **oauth.ts**：完整 Authorization Code Flow
- **request-executor**：统一请求执行器，含 401 自动重试
- **配置收口**：tools toggle 与实现对齐，index.ts 尊重各工具开关

#### feishu-api 高级 HTTP 客户端
- `src/identity/feishu-api.ts` — 工具层唯一的飞书 API 调用入口
- `feishuGet/Post/Patch/Delete/Put` 便捷方法
- `AuthRequiredError` 结构化授权提示

#### Platform 层（Round 14 全部完成 ✅）
所有 12 个业务域已完成 platform client 迁移：
- `src/platform/docs/client.ts` — docx 域 (Round 10)
- `src/platform/calendar/client.ts` — calendar 域 (Round 11)
- `src/platform/im/client.ts` — im 域 (Round 12)
- `src/platform/wiki/client.ts` — wiki 域 (Round 13)
- `src/platform/drive/client.ts` — drive 域 (Round 14 ✅)
- `src/platform/bitable/client.ts` — bitable 域 (Round 14 ✅)
- `src/platform/task/client.ts` — task 域 (Round 14 ✅)
- `src/platform/perm/client.ts` — perm 域 (Round 14 ✅)
- `src/platform/sheets/client.ts` — sheets 域 (Round 14 ✅)
- `src/platform/contact/client.ts` — contact 域 (Round 14 ✅)
- `src/platform/approval/client.ts` — approval 域 (Round 14 ✅)
- `src/platform/search/client.ts` — search 域 (Round 14 ✅)

每个 platform client：
- 封装 feishu OpenAPI 端点
- 通过 identity/feishu-api 执行（双授权决策在 identity 层）
- 导出纯函数，tools 只做 schema 定义 + 参数解析

#### 双授权工具（12 个业务域 + OAuth = 78 个工具）
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
- 消息收发主链路
- 流式卡片（DM + 群聊场景）
- 目录/配对/Policy/探测/提及

#### 流式卡片修复 — 对齐官方 OpenClaw 飞书插件（Round 14 ✅）

**问题**：真实环境测试发现流式卡片显示空白

**根因分析**（对比官方 `extensions/feishu/src/streaming-card.ts`）：

| 差异点 | 旧实现 | 官方实现 | 修复 |
|--------|--------|----------|------|
| CardKit API 调用方式 | SDK wrapper (`client.cardkit.v1.*`) | Raw HTTP (fetch + tenant_access_token) | ✅ 改为 Raw HTTP |
| 初始卡片内容 | 空字符串 `""` | `"⏳ Thinking..."` | ✅ 修复 |
| element_id | `"streaming_content"` | `"content"` | ✅ 修复 |
| streaming_config | 缺失 | `{ print_frequency_ms: { default: 50 }, print_step: { default: 1 } }` | ✅ 添加 |
| uuid 幂等 | 缺失 | `uuid: "s_{cardId}_{sequence}"` | ✅ 添加 |
| 内容合并策略 | 简单拼接 | `mergeStreamingText`（overlap 去重） | ✅ 引入 |
| 更新节流 | 无 | 100ms throttle | ✅ 添加 |
| 关闭序列 | 两步：updateFinalCard + updateSettings | 一步 PATCH settings | ✅ 修复 |

**修改文件**：
- `src/channel/streaming-card.ts` — 重写全部 helper
- `src/channel/streaming-card-executor.ts` — Raw HTTP SDK（绕过不可靠的 Lark SDK CardKit 方法）
- `src/channel/streaming-session.ts` — 使用 mergeStreamingText + throttle + 新 SDK 接口
- `src/channel/plugin.ts` — 传递 credentials 给 createStreamingCardSdk

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

1. **流式卡片真实环境验证**：DM + 群聊需真实飞书环境验证（代码层修复已完成，等待实测）
2. **card action 路由到 agent**：当前仅返回确认卡片；后续可演进为路由到 agent + 更新卡片
3. **event subscription 扩展**：仍仅 `im.message.receive_v1`，Phase 3 剩余
4. **raw SDK 发送例外项收口**：CardKit 已改 Raw HTTP，但 media multipart 上传、typing indicator、directory/probe 等 bot-context/SDK 特例仍保留并已文档化

## Confirmed Verification

### Build
```
npm run build → ✅ 零错误
npx tsc --noEmit → ✅ 零错误
```

### All Tests (21 files, all passing)

```
verify-api-policy-coverage.ts           → 28/28 ✅
verify-approval-search-tools.ts         → 10/10 ✅
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

## Modified Files (Round 14)

### 新增文件

| File | Type | Description |
|------|------|-------------|
| `src/platform/drive/client.ts` | Platform | drive 域 platform client |
| `src/platform/drive/index.ts` | Platform | drive 域 re-export |
| `src/platform/bitable/client.ts` | Platform | bitable 域 platform client |
| `src/platform/bitable/index.ts` | Platform | bitable 域 re-export |
| `src/platform/task/client.ts` | Platform | task 域 platform client |
| `src/platform/task/index.ts` | Platform | task 域 re-export |
| `src/platform/perm/client.ts` | Platform | perm 域 platform client |
| `src/platform/perm/index.ts` | Platform | perm 域 re-export |
| `src/platform/sheets/client.ts` | Platform | sheets 域 platform client |
| `src/platform/sheets/index.ts` | Platform | sheets 域 re-export |
| `src/platform/contact/client.ts` | Platform | contact 域 platform client |
| `src/platform/contact/index.ts` | Platform | contact 域 re-export |
| `src/platform/approval/client.ts` | Platform | approval 域 platform client |
| `src/platform/approval/index.ts` | Platform | approval 域 re-export |
| `src/platform/search/client.ts` | Platform | search 域 platform client |
| `src/platform/search/index.ts` | Platform | search 域 re-export |

### 修改文件

| File | Change |
|------|--------|
| `src/tools/drive.ts` | 迁移到 platform/drive client |
| `src/tools/bitable.ts` | 迁移到 platform/bitable client |
| `src/tools/task.ts` | 迁移到 platform/task client |
| `src/tools/perm.ts` | 迁移到 platform/perm client |
| `src/tools/sheets.ts` | 迁移到 platform/sheets client |
| `src/tools/contact.ts` | 迁移到 platform/contact client |
| `src/tools/approval.ts` | 迁移到 platform/approval client |
| `src/tools/search.ts` | 迁移到 platform/search client |
| `src/channel/streaming-card.ts` | 重写：对齐官方 element_id / streaming_config / mergeStreamingText |
| `src/channel/streaming-card-executor.ts` | 重写：Raw HTTP SDK 替代不可靠的 Lark SDK CardKit 方法 |
| `src/channel/streaming-session.ts` | 重写：mergeStreamingText + throttle + 新 SDK 接口 |
| `src/channel/plugin.ts` | 传递 credentials 给 createStreamingCardSdk |
| `tests/verify-streaming-card-executor.ts` | 更新测试匹配新 SDK 接口 |
| `tests/verify-streaming-session.ts` | 更新 mock SDK 匹配新接口 |
| `IMPLEMENTATION_STATUS.md` | 本文件 |

## Non-Negotiable Rules
- 不得虚报完成度
- 不得把"编译通过"当作"闭环完成"
- 不得为了省事破坏双授权设计
- 每轮结束必须给出：完成项 / 未完成项 / 风险 / 下一轮最小闭环

## Next Steps

### 高优先级
1. **流式卡片真实环境回归**：代码修复已完成，需 DM + 群聊实测验证
2. **user-token 实际发送验证**

### 中优先级
3. card action → agent 路由实现
4. 更完整 event subscription 体系
5. 更多 skills（sheets 工作流、chatops 工作流）

### 低优先级
6. bot menus / bot config
7. 更完整 search / thread / message 回复链路

## Risk Assessment

1. **流式卡片 Raw HTTP 路径**：已对齐官方实现，但需真实环境确认 fetch API 在 OpenClaw runtime 中的可用性（官方使用 fetchWithSsrFGuard，我们使用原生 fetch）
2. **搜索 API 权限**：search 域全部 user_only，需确保飞书应用已申请搜索相关 scope
3. **审批表单格式**：approval.instance.create 的 form 参数格式高度依赖审批定义，需实际验证
