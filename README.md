# OpenClaw Feishu Plus

一个面向 OpenClaw 的 **Feishu/Lark 增强插件**。

定位：
- **不替代**官方 OpenClaw Feishu 插件
- **不修改**官方插件源码
- 仅补全官方当前未覆盖或不够顺手的能力
- 当前优先增强：**Calendar**、**Bitable 批量能力**、**Permission 协作者管理**

设计目标：**加法增强、边界清晰、可回滚、便于持续迭代**。

---

## 当前能力

## 1. `feishu_plus_perm`
Feishu Drive / Bitable 协作者权限增强。

支持动作：
- `list`
- `add`
- `remove`

特点：
- 显式参数校验
- `add` 具备基础幂等处理
- 支持通知开关

---

## 2. `feishu_plus_bitable`
Feishu Bitable 增强操作。

支持动作：
- `list_tables`
- `create_table`
- `delete_record`
- `batch_create_records`
- `batch_update_records`
- `batch_delete_records`

定位：
- 只补官方基础能力之外更偏批量/增强的操作
- 不重复实现官方已有基础 CRUD 工具

---

## 3. `feishu_plus_calendar`
Feishu Calendar 增强工具。

支持动作：
- `list_calendars`
- `list_events`
- `get_event`
- `create_event`
- `update_event`
- `delete_event`
- `list_acls`
- `create_acl`
- `delete_acl`

说明：
- 当前以事件 CRUD 和 ACL 为主
- 后续继续增强 attendees / reminders / recurrence / filtering / timezone helpers

---

## 与官方插件的边界

官方 OpenClaw Feishu 插件已经覆盖较多基础能力：
- `feishu_doc`
- `feishu_drive`
- `feishu_wiki`
- `feishu_perm`
- `feishu_bitable_*`

因此本插件策略是：
- **官方负责基础层**
- **feishu-plus 负责增强层**

推荐分工：
- 文档、云空间、知识库基础能力 → 官方插件
- 日历 → `feishu-plus`
- Bitable 批量增强 → `feishu-plus`
- 协作者增强 → `feishu-plus`

---

## 安装

### 方式 A：从 GitHub Packages 安装

先配置 npm registry：

```bash
npm config set @fushengyk666:registry https://npm.pkg.github.com
```

如果需要认证：

```bash
cat >> ~/.npmrc <<'EOF'
@fushengyk666:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
always-auth=true
EOF
```

安装插件：

```bash
openclaw plugins install @fushengyk666/feishu-plus
```

---

### 方式 B：本地源码开发安装

将仓库放到本地后，按 OpenClaw 插件加载方式接入。

开发时建议：
- 本地改动
- 本地验证
- 打包
- 发布到 GitHub Packages

---

## 配置

插件配置位于：
- `plugins.entries.feishu-plus`

示例：

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
          },
          "defaultNeedNotification": false
        }
      }
    }
  }
}
```

说明：
- `enabled`：插件总开关
- `tools.perm`：协作者增强开关
- `tools.bitable`：Bitable 增强开关
- `tools.calendar`：Calendar 增强开关
- `defaultNeedNotification`：权限变更默认是否通知

---

## 依赖要求

需要 OpenClaw 已正确配置 `channels.feishu`：
- `appId`
- `appSecret`
- 对应 Feishu scopes

本插件会自行获取：
- `tenant_access_token`

并基于 Feishu Server API 调用增强能力。

---

## 当前仓库结构

```text
index.ts
openclaw.plugin.json
src/
  core/
    client.js
    errors.js
    result.js
  tools/
    perm-tool.js
    bitable-tool.js
    calendar-tool.js
  perm-actions.js
  bitable-actions.js
  calendar-actions.js
  schemas.js
  bitable-schemas.js
  calendar-schemas.js
```

当前已经完成第一轮重构：
- core 基础层抽离
- tool 注册层抽离
- 保持外部工具名兼容

后续会继续往模块化方向推进。

---

## 发布

### GitHub Packages

仓库 package name：
- `@fushengyk666/feishu-plus`

发布前准备：

```bash
cat > ~/.npmrc <<'EOF'
@fushengyk666:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
always-auth=true
EOF
```

发布：

```bash
npm publish
```

打包检查：

```bash
npm pack
```

---

## 开发原则

- 飞书相关设计，先查官方开发者文档
- 再对照官方 OpenClaw Feishu 插件源码
- 避免重复造轮子
- 避免直接修改官方插件
- 每轮迭代后打包

---

## 当前状态

当前版本已可用于：
- Calendar 事件 CRUD
- Calendar ACL 管理
- Bitable 批量增强
- Permission 协作者管理

后续重点：
- Calendar 继续增强
- Cloud Docs 高级增强层
- 诊断工具
- 更完整的错误语义化

---

## License

MIT
