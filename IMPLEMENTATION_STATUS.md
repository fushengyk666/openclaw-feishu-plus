# IMPLEMENTATION_STATUS

## Project
openclaw-feishu-plus — 飞书增强 OpenClaw 插件

## Current Status (2026-03-15)

**阶段**: Phase 2 完成 + Phase 3 部分完成
**构建**: ✅ 零错误 | **测试**: ✅ 16 个文件全部通过

---

## 已完成

### 双授权核心架构
- **identity 层完整**: TokenResolver → api-policy → request-executor → feishu-api 链路闭环
- **token-store**: memory / file 两种后端，per appId × per userOpenId
- **token-resolver**: tenant_only / user_only / both 三种策略决策
- **identity_mode**: 全部 70 个工具支持 `auto|user|app` 可选参数
- **auth-prompt**: user_only 场景无 token 时自动生成授权链接
- **oauth**: 完整 Authorization Code Flow
- **request-executor**: 含 401 自动重试（保持 identityMode 一致）
- **79 个 API 操作** 全部在 API_POLICY 注册

### identity_mode 端到端流转

```
Tool Schema (70 tools, identity_mode?: auto|user|app)
  → Platform Client (12 domains, identityMode passthrough)
    → feishu-api.ts (identityMode → executeFeishuRequest)
      → request-executor.ts (identityMode → resolver.resolve)
        → token-resolver.ts (policy + identityMode → token decision)
```

| API policy | mode=auto | mode=user | mode=app |
|------------|-----------|-----------|----------|
| tenant_only | tenant | tenant (logged) | tenant |
| user_only | user (no user→err) | user | user (logged) |
| both | **tenant** (default) | user (no user→err) | tenant |

### 工具域（12 个业务域 + OAuth = 74 个工具）

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

### Channel 层
- 完整 ChannelPlugin 定义（plugin.ts）
- WebSocket + Webhook 双模式入站
- 消息收发主链路（send.ts 支持 identityMode）
- DM + 群聊流式卡片（StreamingCardController 封装）
- 目录/配对/Policy/探测/Mention/Reactions/Media
- Card action 最小链路（webhook → ack card + best-effort agent 路由）

### 流式卡片

| 场景 | 行为 |
|------|------|
| 短回复 | 纯文本直发，不建卡 |
| 长回复 / 结构化 | partial 驱动流式卡片 |
| 多 partial 逐步累积 | 第 2 个 partial 后建卡，节流更新 |
| final-only（无 partial） | 纯文本直发 |
| 建卡失败 | 降级纯文本 |
| 消息不可用 | UnavailableGuard 安全终止 |

### Platform 层
全部 12 个业务域按 `src/platform/{domain}/client.ts` 拆分，tools 仅做 schema/参数解析。

### Skills
| Skill | 说明 |
|-------|------|
| feishu-doc | 文档创建/读取/编辑工作流 |
| feishu-calendar | 日程查询/创建/忙闲协调工作流 |
| feishu-bitable | 多维表格 CRUD 与批量数据工作流 |
| feishu-drive | 云盘文件管理与权限工作流 |
| feishu-approval | 审批定义/实例/操作工作流 |

---

## 目录结构

```
openclaw-feishu-plus/
├── index.ts                          # 插件入口
├── src/
│   ├── channel/                      # OpenClaw 渠道层
│   │   ├── plugin.ts                 # ChannelPlugin 定义 + gateway
│   │   ├── send.ts                   # 消息发送（双授权 HTTP）
│   │   ├── reply-dispatcher.ts       # 回复分发（static / streaming）
│   │   ├── streaming-card-controller.ts # 流式卡片生命周期
│   │   ├── streaming-card-executor.ts   # CardKit raw HTTP SDK
│   │   ├── reasoning-text.ts         # thinking/reasoning 文本拆分
│   │   ├── builder.ts               # 卡片模板构建
│   │   ├── flush-controller.ts       # 节流更新
│   │   ├── unavailable-guard.ts      # 消息不可用检测
│   │   ├── message-unavailable.ts    # 消息不可用处理
│   │   ├── image-resolver.ts         # 图片解析
│   │   ├── media.ts                  # 文件/图片上传
│   │   ├── reactions.ts              # 表情回应
│   │   ├── mention.ts               # @提及解析
│   │   ├── accounts.ts              # 多账号配置
│   │   ├── config.ts                # channel 配置解析
│   │   ├── directory.ts             # 通讯录/群列表
│   │   ├── onboarding.ts            # 引导配置
│   │   ├── policy.ts                # 群聊/DM 策略
│   │   ├── targets.ts              # 目标解析
│   │   ├── probe.ts                 # 状态探测
│   │   ├── card-action.ts           # 卡片交互回调
│   │   ├── reply-mode.ts            # 回复模式选择
│   │   ├── reply-dispatcher-types.ts # 回复类型定义
│   │   ├── footer-config.ts         # 页脚配置
│   │   └── runtime.ts              # runtime 引用
│   ├── identity/                     # 双授权核心层
│   │   ├── token-resolver.ts        # token 决策引擎
│   │   ├── token-store.ts           # token 持久化
│   │   ├── request-executor.ts      # 统一请求执行
│   │   ├── feishu-api.ts            # HTTP 客户端入口
│   │   ├── api-policy.ts            # 79 个操作策略表
│   │   ├── oauth.ts                 # OAuth 流程
│   │   ├── auth-prompt.ts           # 授权提示
│   │   ├── config-schema.ts         # 配置 schema
│   │   ├── client.ts               # lark.Client 工厂
│   │   └── types.ts                 # 类型定义
│   ├── platform/                     # 飞书 API 封装（12 域）
│   │   ├── docs/client.ts
│   │   ├── calendar/client.ts
│   │   ├── im/client.ts
│   │   ├── wiki/client.ts
│   │   ├── drive/client.ts
│   │   ├── bitable/client.ts
│   │   ├── task/client.ts
│   │   ├── perm/client.ts
│   │   ├── sheets/client.ts
│   │   ├── contact/client.ts
│   │   ├── approval/client.ts
│   │   └── search/client.ts
│   ├── tools/                        # OpenClaw 工具注册层（12 域 + oauth）
│   │   ├── doc.ts / calendar.ts / chat.ts / wiki.ts
│   │   ├── drive.ts / bitable.ts / task.ts / perm.ts
│   │   ├── sheets.ts / contact.ts / approval.ts / search.ts
│   │   ├── oauth-tool.ts
│   │   └── identity-mode.ts         # identity_mode 共享 schema
│   └── constants.ts
├── skills/                           # Workflow skills
│   ├── feishu-doc/
│   ├── feishu-calendar/
│   ├── feishu-bitable/
│   ├── feishu-drive/
│   └── feishu-approval/
├── tests/                            # 16 个验证文件
├── IMPLEMENTATION_STATUS.md          # 本文件
├── TECHNICAL_PLAN.md                 # 技术方案
├── INTEGRATION_GUIDE.md              # 接入指南
└── README.md                         # 使用说明
```

---

## 未完成

### 需真实环境验证
1. 流式卡片 DM + 群聊实测
2. user token 端到端验证（OAuth flow → API call）
3. card action → agent 路由真实环境回归

### Phase 3 剩余
4. 更完整 event subscription（仅 `im.message.receive_v1`）
5. Bot menus / bot config
6. 更完整 search / thread / message 回复链路

### 非阻塞增强
7. `identity_mode=auto` 资源归属推断增强
8. 更多 skills（sheets / chatops 工作流）
9. `src/shared/` 通用模型整理

---

## 测试覆盖

| 测试文件 | 检查项 | 说明 |
|----------|--------|------|
| verify-api-policy-coverage | 28 | API Policy 完整性与域匹配 |
| verify-approval-search-tools | 10 | 审批/搜索双授权契约 |
| verify-card-action-routing | 4 | 卡片交互路由 |
| verify-channel-send-paths-audit | 13 | 发送路径静态审计 |
| verify-channel-send | 6 | 消息发送 mock |
| verify-dual-auth-tools | 9 | 所有域双授权路径 |
| verify-dual-auth | 11 | 双授权决策路径 |
| verify-edge-cases | 23 | 边界条件与回归 |
| verify-live-feishu-contract | 23 | 真实环境契约（需凭证） |
| verify-live-harness-init | 29 | 初始化链路 |
| verify-media-send | 4 | 媒体发送 |
| verify-no-direct-sdk-send | 4 | SDK 直发防护 |
| verify-plugin-send-paths | 4 | 插件发送路径 |
| verify-send-path-deep-audit | 18 | 发送路径深度审计 |
| verify-streaming-card-executor | 4 | 流式卡片执行器 |
| verify-tool-toggle-registration | 3 | 工具开关 |

---

## 风险

1. **流式卡片 Raw HTTP**：已对齐官方，需确认 fetch 在 OpenClaw runtime 的可用性
2. **搜索 API 权限**：search 全部 user_only，需确保应用已申请搜索 scope
3. **审批表单格式**：approval.instance.create 的 form 格式高度依赖审批定义
