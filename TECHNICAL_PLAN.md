# OpenClaw Feishu Plus 技术方案（完整交付版）

> 目标：将 `openclaw-feishu-plus` 打造成一个 **100% 面向完成目标** 的飞书增强插件。
>
> 路线：**遵循 OpenClaw 官方插件架构**，**吸收飞书官方插件能力与交互体验**，并以 **双授权（应用授权 + 用户授权）** 作为核心差异化引擎。

---

## 1. 项目目标

本项目的最终目标不是做一个“能编译的飞书插件”，而是做成一个：

1. **符合 OpenClaw 官方插件模式** 的 Feishu/Lark 插件
2. **支持流式卡片回复**，体验对齐飞书官方 `openclaw-lark`
3. **支持双授权模型**：
   - 应用授权（app / tenant）
   - 用户授权（user / OAuth）
4. **逐步补齐飞书开放平台核心能力**
5. **基于少量高频 skill 提升使用体验**
6. 具备长期维护能力：
   - 结构稳定
   - 配置清晰
   - 文档一致
   - 易于 review / 测试 / 扩展

一句话：

> 做一个“OpenClaw 官方风格 + 飞书官方能力深度 + 双授权差异化”的 Feishu Plus 插件。

---

## 2. 设计基线

本项目后续所有实现，统一参考以下三条基线：

### 2.1 OpenClaw 官方飞书插件（架构基线）
- 仓库：`openclaw/openclaw`
- 路径：`extensions/feishu`
- 用途：
  - 学习/对齐 channel plugin 结构
  - account/config/onboarding/outbound/gateway/status 组织方式
  - OpenClaw 官方 runtime / channel 接线风格

### 2.2 飞书官方 OpenClaw 插件（能力与体验基线）
- 仓库：`https://github.com/larksuite/openclaw-lark`
- 用途：
  - 对齐飞书官方推荐能力模型
  - 参考流式卡片回复、交互卡片、权限提示等实现思路
  - 评估哪些飞书能力最值得优先补齐

### 2.3 飞书开放平台文档（API 权威基线）
- 入口：`https://open.feishu.cn/document/server-docs/docs/docs-overview`
- 用途：
  - 所有 API 接入、Scope、权限、事件、限制，以开放平台文档为准
  - 左侧目录切换不同业务域文档

---

## 3. 产品定位

`openclaw-feishu-plus` 的定位不是重复实现一个普通 Feishu 插件，而是：

> 一个兼容 OpenClaw 官方插件模式、同时支持双授权和更完整飞书能力的增强版插件。

### 3.1 核心差异化

只有四个真正值得强调的核心差异化：

1. **双授权运行时决策层**
   - 有用户授权优先走用户授权
   - 无用户授权时回退应用授权
   - 必须用户授权时自动提示用户授权

2. **流式卡片回复**
   - 支持 thinking / generating / complete 三阶段体验
   - 对齐飞书官方插件的用户交互感受

3. **开放平台核心能力补齐**
   - 不停留在 doc/chat/calendar 的基础面
   - 系统性补齐开放平台主业务域

4. **skill 增强层**
   - 用少量高频 workflow skill 提升使用体验
   - 不把每个 API 都硬包装成 skill

---

## 4. 总体架构

建议采用 **四层架构**：

```text
openclaw-feishu-plus/
├── index.ts                         # 插件入口
├── src/
│   ├── channel/                     # OpenClaw 渠道层
│   ├── identity/                    # 双授权决策层（核心）
│   ├── platform/                    # 飞书开放平台能力域
│   ├── tools/                       # OpenClaw 工具注册层
│   ├── skills-support/              # skill 支撑能力（可选）
│   ├── shared/                      # 通用模型、错误、schema、logger
│   └── testing/                     # 测试桩、fixtures、contract tests
├── skills/                          # 高频 workflow skills
├── docs/                            # 项目内部文档（可选）
└── TECHNICAL_PLAN.md
```

---

## 5. 项目结构设计

### 5.1 `src/channel/` —— OpenClaw 渠道接入层

目标：
- 严格对齐 OpenClaw 官方飞书插件的架构职责
- 不把业务逻辑、授权逻辑、工具逻辑揉在一起

建议结构：

```text
src/channel/
├── plugin.ts                # channel plugin 定义
├── meta.ts                  # meta/capabilities/reload/configSchema 映射
├── accounts.ts              # 多账号配置解析
├── config.ts                # channel 级配置收口
├── onboarding.ts            # onboarding / setup
├── directory.ts             # directory / peers / groups
├── outbound.ts              # outbound 统一出口
├── send.ts                  # 发送消息实现
├── mention.ts               # mention 解析/格式化
├── policy.ts                # DM/group policy / gate
├── streaming-card.ts        # 流式卡片能力
├── runtime.ts               # runtime 引用/封装
├── probe.ts                 # 状态探测
├── gateway.ts               # websocket/webhook 接入
├── inbound.ts               # 入站消息处理主链路
├── events.ts                # 事件分发（message/card/action 等）
└── targets.ts               # target/receive_id/路由规范化
```

职责边界：
- `channel/` 只关心：**OpenClaw 如何接飞书**
- 不直接承载飞书平台工具实现细节
- 不直接承载双授权决策细节

---

### 5.2 `src/identity/` —— 双授权核心层（项目壁垒）

这是本项目最重要的一层。

```text
src/identity/
├── token-store.ts           # token 存储
├── token-resolver.ts        # 运行时选 token
├── oauth.ts                 # 用户授权 OAuth 流程
├── app-token.ts             # app/tenant token 获取与缓存
├── api-policy.ts            # 每个接口的授权策略定义
├── scope-policy.ts          # scope 与权限声明
├── auth-prompt.ts           # 缺少用户授权时的提示生成
├── auth-result.ts           # 标准化授权决策结果
└── types.ts
```

#### 核心原则

每个飞书 API 必须声明自己的授权策略：

- `app_only`
- `user_only`
- `prefer_user_fallback_app`

默认推荐：
- 大部分业务接口走 `prefer_user_fallback_app`
- 必须代表用户身份的接口走 `user_only`
- 明确应用级接口走 `app_only`

#### 决策逻辑

输入：
- 当前 operation
- 当前 sender/user
- 当前 chat/session
- 已持有 token 状态
- scope 声明

输出：
- `use_user_token`
- `use_app_token`
- `requires_user_auth`
- `insufficient_scope`
- `token_expired`

#### 用户授权提示策略

与飞书官方插件对齐：

- 如果接口是 `user_only`，且当前无用户授权：
  - 直接提示用户完成授权
- 如果接口是 `prefer_user_fallback_app`：
  - 优先 user
  - 无 user 时回退 app
  - 若 app 失败且 user 可解锁，提示授权

**注意**：
- 第一阶段不做“授权完成后自动恢复操作”
- 第一阶段只做：授权成功 → 提示用户重试
- 第二阶段再做授权后自动恢复

---

### 5.3 `src/platform/` —— 飞书开放平台能力域实现层

这一层是对飞书开放平台文档的系统映射。

建议按业务域拆分：

```text
src/platform/
├── im/
├── docs/
├── wiki/
├── drive/
├── bitable/
├── sheets/
├── calendar/
├── task/
├── contact/
├── approval/
├── search/
├── bot/
├── event/
└── common/
```

每个域内部统一模式：

```text
src/platform/docs/
├── client.ts               # API 调用封装
├── schemas.ts              # 输入输出 schema
├── mapper.ts               # 飞书返回值 → 插件标准对象
├── operations.ts           # 业务操作函数
└── scopes.ts               # 本域所需 scopes
```

#### 为什么这样拆

因为你的目标不是补几个 tool，而是：

> 最终逐步补齐飞书开放平台主要能力域。

所以必须按业务域拆，而不是按“今天想到什么功能”拆。

---

### 5.4 `src/tools/` —— OpenClaw 工具注册层

这一层只负责把 `platform/` 能力转成 OpenClaw 工具。

```text
src/tools/
├── registry.ts             # 统一注册入口
├── doc.ts
├── calendar.ts
├── chat.ts
├── wiki.ts
├── drive.ts
├── bitable.ts
├── task.ts
├── sheets.ts
├── contact.ts
├── approval.ts
└── auth.ts
```

#### 设计原则

- 工具命名统一：`feishu_plus_*`
- 只在这一层定义 OpenClaw Tool schema/description
- 真正业务逻辑全部转调 `platform/*`
- 工具层不再直接写飞书 HTTP 细节

---

### 5.5 `skills/` —— 高频 workflow 增强层

skill 不是底层能力层，而是体验增强层。

建议只做少量高频 skill：

```text
skills/
├── feishu-doc-assistant/
├── feishu-calendar-assistant/
├── feishu-bitable-assistant/
├── feishu-drive-assistant/
└── feishu-chatops/
```

#### 适合做成 skill 的场景

- 文档整理/批量改写/协作发布
- 日程安排/会议协调/忙闲查询
- 多维表格增删改查工作流
- 云盘权限/归档/分享工作流
- 群运营消息/卡片推送/消息处理

#### 不建议做成 skill 的场景

- 每一个裸 API 都做一个 skill
- 用 skill 去替代底层工具

原则：

> **底层靠 tools 全覆盖，上层靠少量 workflow skill 提升好用程度。**

---

## 6. 功能覆盖目标

### 6.1 第一阶段（P0：架构与核心链路）

目标：形成稳定骨架。

必须完成：
- OpenClaw 官方风格 channel 外壳重构
- account/config/runtime 统一
- 双授权核心层落地
- websocket/webhook 统一入口
- 流式卡片主链路
- 基础消息收发稳定
- 基础 policy/gate 完整
- 诊断能力（probe + diagnose）
- 文档与配置口径统一

验收标准：
- 能稳定收消息 / 回消息
- 能流式卡片回复
- 能按策略自动选择 user/app token
- 必须用户授权场景会提示授权

---

### 6.2 第二阶段（P1：核心业务域补齐）

优先补齐以下业务域：
- `im`
- `docs`
- `drive`
- `bitable`
- `sheets`
- `calendar`
- `task`
- `contact`

验收标准：
- 每个域有清晰 tool 接口
- 授权策略清晰
- 主要 CRUD 能力覆盖
- 基本错误模型和返回结构统一

---

### 6.3 第三阶段（P2：交互与高级能力）

补齐：
- card action / callback
- 更完整 event subscription 体系
- approval
- bot menus / bot config
- 更完整 search / user / department / org 相关能力
- 更强的消息搜索、回复链路、线程能力

验收标准：
- 能支撑真实团队/工作流使用
- 与飞书官方插件体验差距显著缩小

---

### 6.4 第四阶段（P3：skill 增强）

补充高频 skill：
- 文档工作流
- 日程工作流
- 多维表格工作流
- 云盘权限工作流
- 群聊卡片运营工作流

验收标准：
- skill 真正减少 prompt 复杂度
- 高频场景明显更易用
- 不与 tools 重复造轮子

---

## 7. 流式卡片方案

目标：对齐飞书官方插件交互体验。

### 7.1 设计原则

- channel 收到 agent 增量输出时，不直接只发纯文本
- 在支持的场景下，优先创建卡片并持续更新
- 状态阶段：
  - thinking
  - generating
  - complete
  - failed

### 7.2 建议模块

- `channel/streaming-card.ts`
- `channel/events.ts`
- `platform/im` 中补卡片相关调用

### 7.3 最小链路

1. 收到用户消息
2. 创建初始卡片（thinking）
3. agent 流式输出过程中持续 patch/update
4. 完成后切为 complete 状态
5. 异常时切 failed

### 7.4 风险与策略

- 群聊、私聊、线程场景可能有差异
- 第一阶段优先保证 **DM** 流式卡片稳定
- 第二阶段再扩 group/thread/card action

---

## 8. 双授权技术方案

### 8.1 总体原则

统一采用：

> **Prefer User, Fallback App**

即：
- 有用户授权 → 优先用用户授权
- 没有用户授权 → 回退应用授权
- 如果接口必须用户授权 → 像飞书官方插件一样提示用户授权

### 8.2 API 策略表

为每个 operation 建立策略定义：

```ts
{
  operation: "calendar.event.create",
  authMode: "prefer_user_fallback_app",
  scopes: {
    app: ["calendar:write"],
    user: ["calendar:write"]
  }
}
```

```ts
{
  operation: "contact.user.me",
  authMode: "user_only",
  scopes: {
    user: ["contact:user.base:readonly"]
  }
}
```

### 8.3 授权提示策略

- `user_only` + 无用户授权 → 直接提示授权
- `prefer_user_fallback_app`：
  - 能用 user 就 user
  - 没 user 就 app
  - app 不足且 user 可解锁时，再提示授权

### 8.4 第一阶段不做的事

- 不做授权后自动恢复复杂上下文
- 不做隐式长链路自动重试

第一阶段只做：
- 授权提示
- 授权成功保存 token
- 提示用户重试原操作

---

## 9. 配置设计原则

配置路径保持 OpenClaw 官方风格：

```json5
channels: {
  "openclaw-feishu-plus": {
    enabled: true,
    defaultAccount: "main",
    connectionMode: "websocket",
    domain: "feishu",
    dmPolicy: "pairing",
    groupPolicy: "open",
    requireMention: true,
    auth: {
      preferUserToken: true,
      autoPromptUserAuth: true,
      store: "keychain-first",
      redirectUri: "https://open.feishu.cn/oauth/callback"
    },
    tools: {
      doc: true,
      drive: true,
      bitable: true,
      sheets: true,
      calendar: true,
      task: true,
      chat: true,
      perm: true,
      contact: false,
      approval: false
    },
    accounts: {
      main: {
        appId: "cli_xxx",
        appSecret: "xxx"
      }
    }
  }
}
```

原则：
- 顶层做共享默认配置
- accounts 做局部覆盖
- 所有运行时路径统一读同一份规范化配置对象

---

## 10. 测试策略

### 10.1 单元测试
覆盖：
- token resolver 决策
- config 解析
- account 解析
- target 解析
- gate / policy
- tool schema 输入输出

### 10.2 集成测试
覆盖：
- websocket 接入
- webhook 接入
- send / reply / card update
- user/app token 选择
- authorization prompt 流程

### 10.3 端到端测试
覆盖：
- 私聊文本
- 私聊流式卡片
- 群聊 mention
- tool 调用成功
- 必须用户授权提示
- 用户授权后重试成功

### 10.4 回归测试
每次 Claude Agent 开发完成一轮，都必须跑：
- build
- lint（如已接入）
- 单元测试
- 关键集成测试

---

## 11. 文档策略

必须统一维护这些文档：

- `README.md`：安装、配置、能力概览
- `IMPLEMENTATION_STATUS.md`：当前真实实现状态
- `CLOSURE_STATUS.md`：真实完成度，不夸大
- `INTEGRATION_GUIDE.md`：接入路径
- `TECHNICAL_PLAN.md`：本方案文档

原则：
- 文档不能虚报完成度
- 不能把“接口预留”写成“能力完成”
- 不能把“编译通过”写成“闭环完成”

---

## 12. Claude Agent 开发流程

后续编码采用：
- **模型**：`local-cliproxy/claude-opus-4-6`
- 方式：由 Claude Agent 按本技术方案逐步实现
- 主控流程：
  1. 由 Claude Agent 按阶段开发
  2. 由主控（本助手）做 review
  3. 输出问题清单
  4. 再让 Claude Agent 修复
  5. 循环直至达到阶段验收标准

### 12.1 约束

Claude Agent 不能自由扩写方向，必须受本方案约束：
- 不能偏离 OpenClaw 官方结构路线
- 不能抛弃双授权设计
- 不能把 skill 层做成底层重复实现
- 不能用临时 patch 替代结构性设计

### 12.2 每轮开发输出要求

Claude Agent 每轮提交必须同时给出：
- 本轮改动目标
- 改动文件清单
- 关键设计说明
- 已完成项
- 未完成项
- 风险点
- 测试结果

### 12.3 Review 闭环要求

每轮 review 至少关注：
- 是否符合本方案结构
- 是否破坏已有能力
- 是否引入新的配置/文档不一致
- 是否真实完成而非伪完成
- 是否达到可继续开发的稳定状态

---

## 13. 100% 完成定义

本项目所谓“100% 完成”，不是指飞书开放平台所有文档页全部一夜补完，而是指：

### 13.1 架构 100% 完成
- 项目结构稳定
- OpenClaw 官方风格对齐完成
- 双授权核心稳定
- 流式卡片主链路稳定
- 配置/文档/运行时一致

### 13.2 范围内能力 100% 完成
- 核心业务域（IM / Docs / Drive / Bitable / Sheets / Calendar / Task / Contact）可用
- channel 能稳定收发
- 流式卡片稳定
- 必须用户授权场景可提示并完成授权
- 高优先级 workflow skills 完成

### 13.3 工程质量 100% 完成
- 可构建
- 可测试
- 可 review
- 可持续维护
- 文档真实完整

也就是说：

> “100% 完成” = 在本项目定义的目标范围内，达到产品、架构、能力、工程四个维度全部可交付。

---

## 14. 当前建议的实施顺序

### Phase 1
- 重构 `channel/`
- 拆 `identity/`
- 收拢 config/account/runtime
- 跑通基础消息闭环

### Phase 2
- 实现流式卡片主链路
- 跑通 DM 场景
- 完成授权提示主链路

### Phase 3
- 补齐核心业务域 tools
- 完成 CRUD 主链路
- 接测试

### Phase 4
- 补 contact / approval / 更复杂 event / card action
- 提升体验

### Phase 5
- 增加高频 skills
- 文档收口
- 终版验收

---

## 15. 最终一句话

> 用 OpenClaw 官方插件做骨架，用飞书官方插件和开放平台文档补血肉，把双授权做成核心引擎，再用少量高频 skill 提升可用性，最终交付一个真正可长期维护、可扩展、可完成的 Feishu Plus 插件。
