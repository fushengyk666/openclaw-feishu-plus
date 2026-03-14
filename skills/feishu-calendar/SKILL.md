# Feishu Calendar Assistant — 飞书日历工作流增强

**能力范围**
- 查询日历列表
- 按时间范围查询日程
- 创建/更新/删除日历事件
- 查询忙闲状态
- 会议时间协调工作流

**适用场景**
- "我明天有什么会？"
- "帮我预约下周三下午 2 点的产品评审会"
- "看看本周哪些时间段比较空闲"
- "帮我找一个下周三和产品团队都有空的时间段"

**使用指南**

### 查询日程
> "查我明天的会议"
> "看看这周每天有几个会"
> "这周五下午有安排吗？"

### 创建日程
> "帮我约下周五下午 3 点的设计评审，时长 1 小时"
> "创建一个周一上午 10 点的站会，持续 30 分钟"
> "创建一个每天早上 7:30 的运动打卡，重复到今年年底"
> "建一个每周一到周五 9 点的晨会"

### 修改/删除日程
> "把下周三的会议推迟到下午 4 点"
> "取消周五下午的产品评审"

### 忙闲查询（需要用户授权）
> "看看我下周一到周三的空闲时间"
> "查一下我明天上午是否有空"

### 时间协调工作流
1. 先用 `feishu_plus_calendar_list` 确定目标日历
2. 用 `feishu_plus_calendar_event_list` 查看已有日程
3. 如果要看是否空闲，用 `feishu_plus_calendar_freebusy`
4. 确认时间后用 `feishu_plus_calendar_event_create` 创建

**身份策略**
- 默认：有用户授权时看到的是用户真实日历
- 忙闲查询（freebusy）**必须用户授权**
- 用应用身份时只能看到应用有权限的日历

**工具列表**
| 工具名 | 说明 | 身份要求 |
|--------|------|----------|
| `feishu_plus_calendar_list` | 列出日历 | 均可 |
| `feishu_plus_calendar_create` | 创建日历 | 均可 |
| `feishu_plus_calendar_delete` | 删除日历 | 均可 |
| `feishu_plus_calendar_update` | 更新日历 | 均可 |
| `feishu_plus_calendar_event_list` | 列出日历事件 | 均可 |
| `feishu_plus_calendar_event_create` | 创建事件 | 均可 |
| `feishu_plus_calendar_event_update` | 更新事件 | 均可 |
| `feishu_plus_calendar_event_delete` | 删除事件 | 均可 |
| `feishu_plus_calendar_freebusy` | 查询忙闲 | 仅用户 |

**时间格式**
- 飞书日历 API 使用 **Unix 秒** 时间戳（不是毫秒）
- 默认时区：`Asia/Shanghai`
- 创建事件时如果不指定时区，默认使用 Asia/Shanghai

**注意事项**
- 日历 ID 通常使用 `primary` 代表主日历
- 事件的 `start_time` / `end_time` 为 Unix 秒时间戳
- 支持通过 `recurrence` 创建/更新重复日程，规则遵循 RFC5545 RRULE（如 `FREQ=DAILY;INTERVAL=1`）
- `COUNT` 和 `UNTIL` 不应同时出现
- 忙闲查询需要提供 `user_ids` 参数
