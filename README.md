# OpenClaw Feishu Plus

一个面向 OpenClaw 的 **Feishu/Lark 增强插件**，在不改动官方 `@openclaw/feishu` 插件的前提下，补齐高频能力：

- 协作者权限管理（Drive / Bitable）
- 多维表格批量操作增强（含删除）
- 日历事件 CRUD 能力

> 设计目标：**加法增强、低耦合、可回滚**。

---

## 功能总览

### 1) `feishu_plus_perm`（权限增强）
用于管理文档/表格/多维表/文件夹等对象的协作者。

- `action=list`：列出协作者
- `action=add`：添加协作者
- `action=remove`：移除协作者

---

### 2) `feishu_plus_bitable`（多维表增强）
用于多维表结构和记录的增强操作。

- `action=list_tables`：列出数据表
- `action=create_table`：新建数据表
- `action=delete_record`：删除单条记录
- `action=batch_create_records`：批量新增记录
- `action=batch_update_records`：批量更新记录
- `action=batch_delete_records`：批量删除记录

---

### 3) `feishu_plus_calendar`（日历增强）
用于日历/事件的常见读写能力。

- `action=list_calendars`：列出日历
- `action=list_events`：列出事件
- `action=get_event`：获取事件详情
- `action=create_event`：创建事件
- `action=update_event`：更新事件
- `action=delete_event`：删除事件

---

## 安装

### 方式 A：通过 npm 包安装（推荐）

```bash
openclaw plugins install @fushengyk666/feishu-plus
```

### 方式 B：本地源码目录加载（开发调试）
将源码放到工作区扩展目录：

```bash
~/.openclaw/workspace/.openclaw/extensions/feishu-plus
```

然后重启 gateway。

---

## 配置

在 OpenClaw 配置中为 `plugins.entries.feishu-plus` 设置开关（可选）：

- `enabled`：总开关（默认 `true`）
- `tools.perm`：权限工具开关（默认 `true`）
- `tools.bitable`：多维表工具开关（默认 `true`）
- `tools.calendar`：日历工具开关（默认 `true`）

示例（节选）：

```json
{
  "plugins": {
    "entries": {
      "feishu-plus": {
        "enabled": true,
        "config": {
          "enabled": true,
          "tools": {
            "perm": true,
            "bitable": true,
            "calendar": true
          }
        }
      }
    }
  }
}
```

---

## 设计原则

- 不修改官方 Feishu 插件源码，降低升级冲突风险
- 参数显式校验，减少误操作
- 仅对 429/5xx 做有限重试
- 错误分层（参数/权限/认证/服务端）
- 可独立禁用、可快速回滚

---

## 兼容与说明

- 依赖 OpenClaw 已正确配置 `channels.feishu`（含 appId/appSecret）
- 本插件定位为官方能力的增强补充，不替代官方插件
- 建议生产环境显式设置 `plugins.allow`，避免非白名单插件自动加载

---

## 发布与版本建议

- 采用语义化版本（SemVer）
- 每次发布前先在测试环境验证三个工具都能注册
- 如需破坏性变更，请升级主版本并在 Release Notes 明示

---

## License

MIT
