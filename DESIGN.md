# 飞书 Dual-Token OpenClaw Plugin — 技术设计文档

> 项目代号：`openclaw-feishu-plus`
> 版本：v0.2-draft
> 作者：Jarvis / 浮生
> 日期：2026-03-09

---

## 0. 核心结论

本项目不是“按功能把接口拆成应用版和用户版”。

**飞书开放平台的大多数 Open API，本质上是同一套接口，当前身份由 `Header Authorization` 里的 Token 类型决定：**
- `tenant_access_token` → 应用身份
- `user_access_token` → 用户身份

因此插件的核心不是“功能优先走哪种身份”，而是：

> **同一套工具、同一套 API 调用逻辑，运行时根据当前可用 Token 决定身份。**

默认规则：
1. **如果当前用户已经授权并且存在可用 `user_access_token`，优先使用用户身份**
2. **如果当前用户未授权用户身份，则自动退回 `tenant_access_token` 使用应用身份**
3. **只有当某个接口明确限制只能使用某一种 Token 类型时，才强制使用对应身份**

---

## 1. 背景与问题定义

你当前看到的两个参考项目，各自只覆盖了一半目标：

### 1.1 OpenClaw 官方 `@openclaw/feishu`
结论：
- 走的是**应用身份**路线
- 支持能力较少
- **不支持用户身份授权**

适合作为：
- OpenClaw 原生插件结构参考
- Channel 接入参考
- 应用身份调用路径参考

但它**不够完整**，因为无法覆盖“代表当前用户执行”的场景。

### 1.2 飞书官方 `@larksuiteoapi/feishu-openclaw-plugin`
结论：
- 走的是**用户身份授权**路线
- 功能覆盖比较全面
- **不支持应用身份并行使用**
- 安装/启用方式会**禁用其他三方插件**

适合作为：
- OAuth / 授权流程参考
- Token 管理参考
- 更完整的工具覆盖参考

但它**不符合你的目标**，因为：
- 没法在“未授权用户身份”时自动退回应用身份
- 会破坏其他插件生态

---

## 2. 项目目标

做一个新的 OpenClaw 飞书插件，满足以下目标：

### 2.1 身份目标
- 同时支持：
  - `tenant_access_token`
  - `user_access_token`
- 同一能力默认遵循：
  - **有用户 token → 用用户 token**
  - **没有用户 token → 用应用 token**

### 2.2 工程目标
- 结构清晰
- 易扩展
- 易维护
- 后续新增 API 能力时，不需要重写底层架构

### 2.3 生态目标
- 不禁用其他三方插件
- 不覆盖其他插件配置
- 不强行接管整个插件环境
- 支持低侵入安装与共存

---

## 3. 正确的设计原则

这部分是方案不可偏离的基础约束。

### 原则 1：身份是 Token 决定的，不是模块决定的
不能简单认为：
- 文档一定是应用身份
- 日历一定是用户身份

更准确的做法是：
- **先看接口是否允许两种 token**
- 如果两种都允许，则**优先 user token，其次 tenant token**
- 如果接口明确只支持某一种 token，则按接口限制执行

### 原则 2：同一 API 尽量共用一套调用封装
不要为每个能力都拆两套完全独立实现：
- `doc-by-tenant`
- `doc-by-user`

应该做成：
- 一个 API 封装
- 一个身份解析层
- 一个请求执行器

身份切换只影响：
- `Authorization` header
- token 获取逻辑
- 少量接口能力限制判断

### 原则 3：默认策略必须是 `user-if-available-else-tenant`
这是整个插件最关键的默认行为：

```text
如果当前用户存在可用 user_access_token：用 user_access_token
否则：用 tenant_access_token
```

### 原则 4：接口限制优先于默认策略
如果飞书文档明确某接口只能：
- tenant token
- 或 user token

则直接遵从接口限制，不做错误降级。

### 原则 5：授权是“按需补齐”，不是“先全量强制”
默认不要一开始要求用户授权全部范围。
应该是：
- 未授权时先尝试 tenant
- 真遇到必须 user token 的能力，再提示用户授权
- 授权范围按需申请

### 原则 6：插件必须可共存
新的插件必须：
- 独立 plugin id
- 独立 channel id / 或支持 tools-only 模式
- 独立配置命名空间
- 不修改、不禁用已有插件

---

## 4. 用户视角下的目标行为

### 场景 A：用户未授权，先用应用身份
用户：
> 帮我创建一个飞书文档《本周计划》

系统行为：
- 检测到用户没有 `user_access_token`
- 该接口支持应用 token
- 直接使用 `tenant_access_token`
- 创建文档成功

结果：
- 用户无需先授权
- 功能立即可用

### 场景 B：用户已授权，则自动切到用户身份
用户：
> 帮我创建一个飞书文档《本周计划》

系统行为：
- 检测到该用户已经授权
- 该接口支持 user token
- 优先使用 `user_access_token`
- 文档以用户身份创建

结果：
- 同样是创建文档，但身份自动升级为用户身份

### 场景 C：接口只支持用户身份
用户：
> 帮我查看我明天的日历安排

系统行为：
- 检查接口要求：仅支持或更合理依赖 user token
- 若无用户 token，则触发授权流程
- 授权成功后再读取数据

结果：
- 返回的是“当前用户的真实数据”

### 场景 D：插件不影响其他插件
用户安装本插件后：
- 其他 Telegram / 自定义 / 现有 OpenClaw 插件继续正常运行
- 本插件不会因为安装过程去禁用别人

---

## 5. 总体架构

```text
OpenClaw
  └── openclaw-feishu-plus-plugin
        ├── channel/             # 飞书消息通道（可选）
        ├── tools/               # 各类能力工具
        ├── core/client.ts       # SDK 客户端工厂
        ├── core/token-resolver.ts
        ├── core/token-store.ts
        ├── core/api-policy.ts
        ├── core/request-executor.ts
        ├── core/oauth.ts
        └── core/config-schema.ts
```

关键不在于“工具多”，而在于底层四层抽象是否正确：

1. **Token Store**：保存并刷新 user token
2. **Token Resolver**：决定本次调用到底用哪个 token
3. **API Policy Registry**：声明接口是否支持 tenant/user/both
4. **Request Executor**：统一注入 Authorization 发请求

---

## 6. 核心设计一：Token Resolver

这是替代之前错误“能力优先路由”的真正核心。

### 6.1 责任
`TokenResolver` 的职责只有一个：

> **根据接口策略 + 当前用户授权状态，决定本次请求应当使用哪个 Token。**

### 6.2 决策逻辑

```text
输入：
- apiKey / operation
- currentUser
- tenant token 是否可用
- user token 是否可用

步骤：
1. 查询该 operation 的 API policy
2. 若 policy = tenant_only → 用 tenant token
3. 若 policy = user_only → 用 user token；没有则要求授权
4. 若 policy = both:
   4.1 当前用户存在可用 user token → 用 user token
   4.2 否则 → 用 tenant token
```

### 6.3 伪代码

```ts
export type TokenKind = "tenant" | "user";
export type ApiSupport = "tenant_only" | "user_only" | "both";

export interface ResolveTokenInput {
  operation: string;
  userId?: string;
}

export interface ResolveTokenResult {
  kind: TokenKind;
  accessToken: string;
}

export async function resolveToken(input: ResolveTokenInput): Promise<ResolveTokenResult> {
  const policy = getApiPolicy(input.operation);

  if (policy.support === "tenant_only") {
    return {
      kind: "tenant",
      accessToken: await getTenantAccessToken(),
    };
  }

  if (policy.support === "user_only") {
    if (!input.userId) throw new NeedUserAuthorizationError("missing_user");

    const userToken = await getValidUserAccessToken(input.userId);
    if (!userToken) throw new NeedUserAuthorizationError("missing_user_token");

    return {
      kind: "user",
      accessToken: userToken,
    };
  }

  // both
  if (input.userId) {
    const userToken = await getValidUserAccessToken(input.userId);
    if (userToken) {
      return {
        kind: "user",
        accessToken: userToken,
      };
    }
  }

  return {
    kind: "tenant",
    accessToken: await getTenantAccessToken(),
  };
}
```

---

## 7. 核心设计二：API Policy Registry

为了保证后续扩展性，不把 token 规则散落在每个工具里。

### 7.1 设计目标
给每个 operation 标记：
- `tenant_only`
- `user_only`
- `both`

以及必要时记录：
- 所需 scopes
- 接口备注
- 失败时是否可提示授权

### 7.2 结构示例

```ts
export interface ApiPolicy {
  support: "tenant_only" | "user_only" | "both";
  userScopes?: string[];
  tenantScopes?: string[];
  note?: string;
}

export const API_POLICY: Record<string, ApiPolicy> = {
  "docx.document.create": {
    support: "both",
    userScopes: ["docx:document"],
    tenantScopes: ["docx:document"],
  },
  "docx.document.get": {
    support: "both",
  },
  "calendar.calendar.get": {
    support: "both",
  },
  "calendar.event.list": {
    support: "both",
  },
  "approval.instance.create": {
    support: "user_only",
  },
  "tenant.some-admin-api": {
    support: "tenant_only",
  },
};
```

### 7.3 作用
这样未来新增能力时，只需要：
1. 新增工具方法
2. 在 policy registry 注册 operation 支持情况
3. 复用同一套 token 解析和请求执行逻辑

维护成本会非常低。

---

## 8. 核心设计三：统一 Request Executor

### 8.1 目标
让工具层不用关心身份切换细节。

工具层只说：
- 我要调用哪个 operation
- 请求参数是什么
- 当前用户是谁

执行器自动完成：
- 解析 token
- 注入 `Authorization: Bearer xxx`
- 调 SDK / HTTP 请求
- 处理 401 / token refresh / retry

### 8.2 伪代码

```ts
export async function executeFeishuRequest<T>(opts: {
  operation: string;
  userId?: string;
  invoke: (ctx: { accessToken: string; tokenKind: "tenant" | "user" }) => Promise<T>;
}): Promise<T> {
  const resolved = await resolveToken({
    operation: opts.operation,
    userId: opts.userId,
  });

  return await opts.invoke({
    accessToken: resolved.accessToken,
    tokenKind: resolved.kind,
  });
}
```

工具调用示例：

```ts
const result = await executeFeishuRequest({
  operation: "docx.document.create",
  userId: currentUserId,
  invoke: async ({ accessToken }) => {
    return await sdk.docx.document.create(payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  },
});
```

---

## 9. 核心设计四：Token Store 与 OAuth

### 9.1 tenant token
- 插件使用 `appId + appSecret` 获取 `tenant_access_token`
- 可由 SDK 管理，或自建轻量缓存层
- 属于全局应用级 token

### 9.2 user token
- 通过 OAuth 获取 `user_access_token`
- 需要持久化：
  - `access_token`
  - `refresh_token`
  - `expire_at`
  - `scope`
  - `user_id/open_id/union_id`

### 9.3 默认授权策略
默认不是一开始就强制用户授权。

而是：
1. 先允许插件在无用户授权情况下以 tenant 运行
2. 当用户开始使用需要更高精度或明确 user-only 的能力时，再触发授权
3. 授权后系统自动切换到 user token 优先

### 9.4 授权方式
优先参考飞书官方插件中成熟的 OAuth 设计，但在工程上做两点改造：
- 不接管/破坏其他插件
- 授权后纳入统一 `TokenStore + TokenResolver`

---

## 10. 工具层设计

### 10.1 目录建议

```text
src/
  core/
    client.ts
    token-resolver.ts
    token-store.ts
    token-refresh.ts
    api-policy.ts
    request-executor.ts
    oauth.ts
    config-schema.ts
  tools/
    doc.ts
    wiki.ts
    drive.ts
    bitable.ts
    calendar.ts
    task.ts
    approval.ts
    mail.ts
    contact.ts
  channel/
    plugin.ts
    onboarding.ts
```

### 10.2 工具层职责
每个工具只负责三件事：
1. 参数校验
2. 定义 operation 名称
3. 调用统一 executor

**不要在工具层手写“如果用户授权了就怎么怎么样”的逻辑。**
那会导致后期不可维护。

---

## 11. 插件共存设计

这是必须守住的工程约束。

### 11.1 独立插件 ID
建议：
- plugin id：`openclaw-feishu-plus-plugin`
- channel id：`openclaw-feishu-plus`

不要占用：
- `feishu`
- `feishu-openclaw-plugin`

### 11.2 独立配置命名空间
配置放在：

```json
channels.openclaw-feishu-plus
```

不要写到：

```json
channels.feishu
```

### 11.3 运行模式
支持两种模式：

#### 模式一：`full`
- 注册 channel
- 注册 tools
- 作为完整飞书插件工作

#### 模式二：`tools-only`
- 只注册工具
- 不接管消息入口
- 可与其他飞书 channel 并存

### 11.4 安装原则
安装脚本必须：
- append 配置
- 不覆盖老配置
- 不禁用已有插件
- 不改别人的 allowlist / entries

---

## 12. 配置设计

```json
{
  "channels": {
    "openclaw-feishu-plus": {
      "enabled": true,
      "mode": "full",
      "appId": "cli_xxx",
      "appSecret": "xxx",
      "domain": "feishu",
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
        "approval": true,
        "mail": true,
        "contact": true
      }
    }
  }
}
```

关键配置只有一条核心语义：

```json
"preferUserToken": true
```

含义：
- 对于 `support = both` 的接口，优先 user token
- 无 user token 时自动退回 tenant token

---

## 13. 开发路线

### Phase 1：底座打通
先完成底层统一抽象：
- `token-store.ts`
- `token-resolver.ts`
- `api-policy.ts`
- `request-executor.ts`
- `config-schema.ts`

这一步决定后续维护性，必须先做好。

### Phase 2：最小能力闭环
先打通两个最关键样例：
1. `docx.document.create`
2. `calendar.event.list`

验证点：
- 未授权用户时能自动用 tenant token
- 已授权用户时会自动切到 user token
- 接口若要求 user-only，则能正确触发授权

### Phase 3：扩展能力
在统一架构上继续扩：
- wiki
- drive
- bitable
- task
- approval
- mail
- contact

### Phase 4：诊断与稳定性
增加：
- token 状态诊断
- scope 缺失诊断
- refresh 失败提示
- 插件安装自检

---

## 14. 与之前错误方案的差异

这次修正后，方案与之前版本最大的不同是：

### 之前错误点
我把核心设计写成了：
- 文档类默认 TAT
- 日历/任务默认 UAT
- 按“功能域”给 identity preference

这个抽象不准确。

### 现在正确点
应该改成：
- **接口主体尽量统一**
- **身份由 Authorization token 类型决定**
- **默认优先 user token，缺失时回退 tenant token**
- **只有接口文档明确限制 token 类型时才强制单身份**

也就是说，设计核心从：

> Capability-first Router

改成了：

> **Token-first Identity Resolver**

这是本项目真正正确的底层抽象。

---

## 15. 最终方案一句话总结

> 这是一个新的 OpenClaw 飞书插件：
> **同一套工具与接口封装，运行时按当前可用 Token 自动选择身份；默认“有用户 token 就走用户，没有就走应用”，并且不破坏其他三方插件生态。**

---

## 16. 后续执行约束

等方案确认后，再进入开发阶段。

执行顺序固定为：
1. **先切换到 Claude Opus 4.6 编写代码**
2. **代码完成后切回 GPT-5.4 做 reviewer**
3. **review 通过后再执行后续动作**

当前阶段：
- **只更新方案，不开始开发**

---

## 17. 当前待确认点

在正式开发前，只需要你确认以下三点：

1. 是否接受默认身份策略：
   - `user-if-available-else-tenant`

2. 是否接受工程结构：
   - `TokenResolver + ApiPolicyRegistry + RequestExecutor + TokenStore`

3. 是否接受共存方式：
   - 独立 plugin/channel/config namespace
   - 不影响其他插件

如果这三点确认，后面就可以进入编码阶段。
