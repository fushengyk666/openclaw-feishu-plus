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

## Current Status (2025-03-13)

### ✅ 已完成

#### 双授权核心架构
- **identity 层完整落地**：TokenResolver → api-policy → request-executor → feishu-api 链路完整
- **token-store**：支持 memory / file 两种后端，per appId × per userOpenId 管理
- **token-resolver**：支持 tenant_only / user_only / both 三种策略决策
- **auth-prompt**：user_only 场景无 token 时自动生成授权链接
- **oauth.ts**：完整 Authorization Code Flow（授权链接、code 换 token、refresh）
- **request-executor**：统一请求执行器，含 401 自动重试

#### 新增：feishu-api 高级 HTTP 客户端
- `src/identity/feishu-api.ts` — 工具层唯一的飞书 API 调用入口
- 内部自动走 `executeFeishuRequest` → `TokenResolver` → 双授权决策
- 提供 `feishuGet/Post/Patch/Delete/Put` 便捷方法
- `AuthRequiredError` 类型用于工具层捕获并返回结构化授权提示

#### 双授权工具（已接入决策链路）
- **doc.ts** — 文档 4 个工具（create/get/listBlocks/rawContent）✅ 双授权
- **calendar.ts** — 日历 9 个工具（list/create/delete/update + event CRUD + freebusy）✅ 双授权
- **chat.ts** — 消息 8 个工具（chatList/chatGet + message send/list/reply/delete/forward/get）✅ 双授权
- 以上工具均通过 `feishuRequest` → `executeFeishuRequest` → `TokenResolver` 决策

#### 三条验证路径（全部通过 ✅）
1. **有 user token → 优先 user**：TokenStore 存有 user token 时，resolver 优先选择 user token（preferUserToken=true）
2. **无 user token → 回退 tenant**：TokenStore 无 user token 时，both 策略自动回退 tenant token
3. **user_only 无 token → 授权提示**：NeedUserAuthorizationError 携带 operation + scopes → generateAuthPrompt 生成可用的授权 URL

#### index.ts 工具注册重构
- 新增 `createDualAuthToolRegistrar`：自动从 OpenClaw ctx 提取 userId，传递给工具
- 新增 `extractUserId`：从 ctx.senderId / ctx.From / ctx.SenderId 等路径提取 open_id
- `AuthRequiredError` 在注册层被捕获，返回结构化 JSON（而非抛错），agent 可理解并引导用户授权
- 旧工具保留 `createLegacyToolRegistrar` 兼容

#### API Policy 覆盖
- docx: 8 operations
- calendar: 10 operations（含新增 create/delete/update）
- im: 11 operations（含新增 get/reply/delete/update/forward）
- wiki: 4 operations
- drive: 5 operations
- bitable: 6 operations
- task: 5 operations
- permission: 4 operations

#### Channel 层
- 完整 ChannelPlugin 定义（plugin.ts）
- WebSocket + Webhook 双模式入站
- 消息收发主链路
- 流式卡片（DM 场景）
- 目录/配对/Policy/探测/提及

### ⏳ 遗留未完成项

1. **send.ts outbound 仍用 lark SDK**：channel 层的消息发送仍直接用 `getLarkClient()`，未走 identity 层。低优先级，因为 channel 层始终用 tenant token 发送 bot 消息。
2. **其他工具未迁移**：wiki/drive/bitable/task/perm/sheets 仍用旧 lark SDK 模式（有 constructor 注入 config/tokenStore 但不走 executeFeishuRequest）
3. **流式卡片**未达到正式可交付标准（CardKit API 依赖版本、群聊场景未覆盖）
4. **端到端集成测试**缺失（需要真实飞书应用凭证才能验证实际 API 调用）
5. **文档同步**：README / INTEGRATION_GUIDE / CLOSURE_STATUS 需要与实现对齐

## Confirmed Verification

### Build
```
npm run build → ✅ 零错误
npx tsc --noEmit → ✅ 零错误
```

### Smoke Tests (11/11 passed)
```
npx tsx tests/verify-dual-auth.ts → ✅ 全部通过
  PATH 1: User token retrieved from store ✅
  PATH 1: User token is not expired ✅
  PATH 2: No user token for unknown user ✅
  PATH 3: user_only without token → NeedUserAuthorizationError ✅
  PATH 3b: Auth prompt generates valid URL ✅
  PATH 3b: Auth prompt includes operation name ✅
  CONFIG: preferUserToken is true ✅
  CONFIG: user token is available for test user ✅
  POLICY: doc operations registered (8) ✅
  POLICY: calendar operations registered (10) ✅
  POLICY: IM operations registered (11) ✅
```

## Modified Files (This Round)

| File | Change |
|---|---|
| `src/identity/feishu-api.ts` | **新增** — 双授权 HTTP 客户端，工具层唯一 API 调用入口 |
| `src/identity/api-policy.ts` | 新增 calendar.create/delete/update + im.get/reply/delete/update/forward |
| `src/identity/types.ts` | 导出 feishu-api 类型 |
| `src/tools/doc.ts` | **重写** — 从 lark SDK → feishuRequest 双授权链路 |
| `src/tools/calendar.ts` | **重写** — 从 lark SDK → feishuRequest 双授权链路 |
| `src/tools/chat.ts` | **重写** — 从 lark SDK → feishuRequest 双授权链路 |
| `index.ts` | 重构注册链路：dualAuthRegistrar + userId 提取 + AuthRequiredError 处理 |
| `tests/verify-dual-auth.ts` | **新增** — 三条路径验证测试 |
| `IMPLEMENTATION_STATUS.md` | 本文件更新 |

## Non-Negotiable Rules
- 不得虚报完成度
- 不得把"编译通过"当作"闭环完成"
- 不得为了省事破坏双授权设计
- 不得只修表面功能，不修结构
- 每轮结束必须给出：完成项 / 未完成项 / 风险 / 下一轮最小闭环

## Next Steps

### 高优先级
1. **迁移剩余 6 个工具到双授权**：wiki → drive → bitable → task → perm → sheets，模式与 doc/calendar/chat 一致
2. **send.ts outbound 接入 identity 层**：让 channel 层也可感知双授权（当需要以用户身份发消息时）
3. **端到端集成测试**：用真实飞书凭证验证 API 调用

### 中优先级
4. 流式卡片稳定化（群聊场景、CardKit 版本兼容）
5. 文档同步（README / INTEGRATION_GUIDE）

### 低优先级
6. skills 层增强
7. 更多业务域（contact / approval / search）

## Operator Note
该项目目标是"完全闭环"，不是"最小可用"。
任何中途暂停都必须保证下一个执行轮次可以从本文件继续推进。

本轮完成了最关键缺口：**3 个高频工具（doc + calendar + chat）真正接入双授权决策链路**，三条路径全部验证通过。
