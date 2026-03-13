# Feishu Approval Assistant — 飞书审批工作流增强

**能力范围**
- 获取审批定义（含表单字段）
- 列出/获取审批实例
- 创建审批实例（需要用户授权）
- 同意/拒绝审批任务（需要用户授权）
- 撤回审批实例（需要用户授权）

**适用场景**
- "帮我查看审批定义 xxx 的表单字段"
- "查一下最近一周有哪些待审批的请假申请"
- "帮我提交一个请假审批"
- "同意/拒绝审批实例 xxx"
- "撤回我提交的审批 xxx"

**使用指南**

### 查看审批定义
> "获取审批定义 APPROVAL_CODE 的详情"
> "看看请假审批需要填哪些字段"

### 查询审批实例
> "列出审批 APPROVAL_CODE 最近一周的实例"
> "获取审批实例 xxx 的详情"

### 创建审批实例（需要用户授权）
> "帮我提交一个请假审批，从明天到后天"
> "发起一个报销审批"

注意：创建审批需要按审批定义的表单格式提供 form 参数（JSON 字符串）。

**创建审批工作流：**
1. 先用 `feishu_plus_approval_get_definition` 获取审批定义，了解表单字段
2. 根据字段定义构造 form JSON
3. 用 `feishu_plus_approval_create_instance` 提交

### 审批操作（需要用户授权）
> "同意审批实例 xxx 的任务 yyy"
> "拒绝审批实例 xxx 的任务 yyy，理由是……"
> "撤回审批实例 xxx"

**身份策略**
- **获取定义/列出/获取实例**：支持应用/用户双身份
- **创建实例/同意/拒绝/撤回**：**必须用户授权**
- 如果用户未授权，工具会自动返回授权提示链接

**工具列表**
| 工具名 | 说明 | 身份要求 |
|--------|------|----------|
| `feishu_plus_approval_get_definition` | 获取审批定义 | 均可 |
| `feishu_plus_approval_list_instances` | 列出审批实例 | 均可 |
| `feishu_plus_approval_get_instance` | 获取审批实例详情 | 均可 |
| `feishu_plus_approval_create_instance` | 创建审批实例 | 仅用户 |
| `feishu_plus_approval_approve` | 同意审批任务 | 仅用户 |
| `feishu_plus_approval_reject` | 拒绝审批任务 | 仅用户 |
| `feishu_plus_approval_cancel` | 撤回审批实例 | 仅用户 |

**注意事项**
- `approval_code` 是审批定义的唯一标识，在飞书管理后台可查看
- `form` 参数为 JSON 字符串，需严格按审批定义的控件格式填写
- 时间参数使用 Unix **毫秒** 时间戳（不同于日历的秒级时间戳）
- 审批操作（同意/拒绝）需要 `task_id`，可从审批实例详情中获取
