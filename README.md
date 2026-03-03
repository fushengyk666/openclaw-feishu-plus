# feishu-plus (MVP)

目标：在不修改官方 `@openclaw/feishu` 的前提下，叠加一个增强插件。

## 当前能力

### 1) 协作者管理（已上线）
- `feishu_plus_perm`
  - `action=list` 列出现有协作者
  - `action=add` 添加协作者（幂等：已存在则 noop）
  - `action=remove` 移除协作者

### 2) 多维表格增强（已上线）
- `feishu_plus_bitable`
  - `action=list_tables` 列出数据表
  - `action=create_table` 新建数据表
  - `action=delete_record` 删除单条记录
  - `action=batch_create_records` 批量新增记录
  - `action=batch_update_records` 批量更新记录
  - `action=batch_delete_records` 批量删除记录

说明：你问的“删除记录”已支持（`delete_record` / `batch_delete_records`）。

### 3) 日历增强（已上线）
- `feishu_plus_calendar`
  - `action=list_calendars` 列日历
  - `action=list_events` 列事件
  - `action=get_event` 查单事件
  - `action=create_event` 创建事件
  - `action=update_event` 更新事件
  - `action=delete_event` 删除事件

## 设计原则

- 不改官方插件源码，避免升级覆盖
- 强参数校验
- 仅对 429/5xx 重试（有限次数）
- 错误分层：权限/参数/令牌/服务端
- 可独立启停与回滚
