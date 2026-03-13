# Feishu Bitable Assistant — 飞书多维表格工作流增强

**能力范围**
- 获取多维表格应用信息
- 列出数据表
- 记录的增删改查（CRUD）
- 按条件筛选与排序
- 批量数据操作工作流

**适用场景**
- "查看表格 xxx 里的所有记录"
- "帮我在表格里新增一条记录"
- "把任务列表里已完成的标记为 done"
- "筛选出所有优先级为 P0 的需求"
- "每日同步数据到多维表格"

**使用指南**

### 查询数据
> "列出多维表格 xxx 的所有表"
> "查看表 yyy 中的最近 20 条记录"
> "筛选出状态为'进行中'的记录"

### 新增记录
> "在表 yyy 中新增一条记录：名称=xxx, 状态=待处理"

### 更新记录
> "把记录 zzz 的状态改为'已完成'"

### 删除记录
> "删除表 yyy 中的记录 zzz"

### 批量工作流
1. 用 `feishu_plus_bitable_list_tables` 找到目标表
2. 用 `feishu_plus_bitable_list_records` 读取数据（支持 filter/sort）
3. 用 `feishu_plus_bitable_create_record` / `update_record` 写入
4. 循环执行批量操作

**身份策略**
- 均支持应用/用户双身份
- 用户身份下操作的表格基于用户权限

**工具列表**
| 工具名 | 说明 |
|--------|------|
| `feishu_plus_bitable_get_app` | 获取多维表格应用信息 |
| `feishu_plus_bitable_list_tables` | 列出数据表 |
| `feishu_plus_bitable_list_records` | 列出记录（支持筛选/排序/分页） |
| `feishu_plus_bitable_create_record` | 创建记录 |
| `feishu_plus_bitable_update_record` | 更新记录 |
| `feishu_plus_bitable_delete_record` | 删除记录 |

**参数格式**
- `fields`: JSON 字符串，key 为字段名，value 为字段值
- `filter`: JSON 字符串，飞书筛选条件格式
- `sort`: JSON 字符串，排序条件
- `app_token`: 多维表格 URL 中 `/base/` 后面的部分
- `table_id`: 表 ID，可通过 list_tables 获取

**注意事项**
- 字段名区分大小写
- 多选/关联类型字段的值为数组
- 创建/更新记录时，字段类型需与表定义一致
