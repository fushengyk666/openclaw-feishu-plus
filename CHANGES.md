# 更新日志

所有重要更改都将记录在此文件中。

## [0.1.1] - 2026-03-10

### 改进 🚀

- **入站消息结构化**
  - 新增 `FeishuInboundMessage` 接口：标准化的飞书入站消息对象
  - 新增 `InboundMessageBridge` 接口：用于将消息注入 OpenClaw 的桥接处理器
  - `handleIncomingMessage()` 现在会构造规范的 `FeishuInboundMessage` 对象
  - 支持通过 bridge 注入到 OpenClaw（如果 OpenClaw 提供）
  - 没有 bridge 时回退到日志记录（当前默认行为）

- **出站消息 Token-first 路径**
  - `sendMessage()` 现在接收 `tokenResolver` 参数
  - 使用 `tokenResolver.resolve()` 决定使用 user 还是 tenant token
  - 默认策略：`user-if-available-else-tenant`
  - 如果需要 user token，通过 HTTP API 直接调用
  - 如果使用 tenant token，使用 SDK

- **Plugin 入口接口收口**
  - 定义了 `OpenClawPluginAPI` 接口
  - 支持 `inboundBridge` 可选参数（OpenClaw 可提供）
  - `initPlugin()` 返回的 `PluginContext` 包含 `inboundBridge?` 字段
  - 如果 OpenClaw 提供了 bridge，自动注入到 context

- **文档诚实度更新**
  - 新增 `CLOSURE_STATUS.md`：诚实说明当前闭环状态
  - 更新 `README.md`：Channel 架构图和消息处理流程
  - 明确标注哪些已完成、哪些未完成

### 修复 🐛

- 修复 `sendMessage()` 不遵循 token-first 架构的问题
- 修复 `handleIncomingMessage()` 只记录日志的问题

### 文档 📝

- 新增 `CLOSURE_STATUS.md`：详细的闭环状态说明
- 更新 `DELIVERY_SUMMARY.md`：本次更新内容总结
- 更新 `README.md`：诚实地反映当前状态

## [0.1.0] - 2026-03-10

### 新增 ✨

- **Channel 消息监听**
  - WebSocket 模式：使用 `@larksuiteoapi/node-sdk` 的 `WSClient` 建立长连接
  - Webhook 模式：提供 `EventDispatcher` 适配器（Express/Koa）
  - 接收并解析 `im.message.receive_v1` 事件
  - 过滤机器人自己发送的消息
  - 支持消息类型识别（text/interactive 等）

- **消息发送能力**
  - 新增 `sendMessage()` 函数，用于向飞书发送消息
  - 支持多种消息类型（text/post/image/file/card等）

- **Onboarding 增强**
  - 新增机器人信息获取（`/open-apis/bot/v3/info`）
  - 显示应用名称和机器人名称
  - WebSocket/Webhook 模式配置提示

- **完整的工具实现**
  - **文档工具** (`doc.ts`): 创建、获取、列出文档块
  - **日历工具** (`calendar.ts`): 列出日历、事件、忙闲状态
  - **授权工具** (`oauth-tool.ts`): 授权状态、触发授权、回调处理、撤销授权
  - **群聊工具** (`chat.ts`): 列出群聊、获取群聊信息、发送消息、列出消息
  - **Wiki 工具** (`wiki.ts`): 列出空间、获取节点、列出节点、创建空间
  - **云盘工具** (`drive.ts`): 列出文件、获取文件信息、下载、上传、创建文件夹
  - **多维表格工具** (`bitable.ts`): 获取应用、列出表格、记录增删改查
  - **任务工具** (`task.ts`): 获取/列出/创建/更新/完成任务
  - **权限工具** (`perm.ts`): 权限列表、创建、更新、删除、转移所有权

- **架构改进**
  - Token-first dual-token 架构
  - 自动根据接口支持情况选择 token 类型
  - TokenStore 持久化用户 token
  - API Policy Registry 注册接口策略

### 改进 🚀

- **配置 Schema**
  - 新增 `mode`: `tools-only`（默认）或 `full`
  - 新增 `connectionMode`: `websocket`（推荐）或 `webhook`
  - 所有工具可独立开关

- **错误处理**
  - Channel 初始化失败不影响工具功能
  - 详细的日志输出
  - Onboarding 警告提示

### 文档 📝

- 更新 README，包含 Channel 使用说明
- 添加 WebSocket/Webhook 模式配置示例
- 添加 Channel 架构图
- 添加故障排查章节

### 待完成 🔲

- 消息自动回复功能
- 消息转发到 OpenClaw 消息总线
- 互动卡片事件处理
- 更多消息类型支持（图片、文件等）
- Webhook 模式的完整示例
- 单元测试

## [0.0.1] - 初始版本

### 新增 ✨

- 基础插件架构
- Token-first dual-token 设计
- 配置 Schema（zod）
- TokenStore 持久化
- TokenResolver 自动解析
- RequestExecutor 统一请求执行
- API Policy Registry

### 骨架实现 🔲

- Doc Tools（已实现）
- Calendar Tools（已实现）
- OAuth Tools（已实现）
- Wiki Tools（已实现）
- Drive Tools（已实现）
- Bitable Tools（已实现）
- Task Tools（已实现）
- Chat Tools（已实现）
- Perm Tools（已实现）

### 未实现 🚫

- Channel WebSocket/Webhook（0.1.0 已实现）
- 消息入站处理（0.1.0 已部分实现）
- 消息出站处理（0.1.0 已实现）
