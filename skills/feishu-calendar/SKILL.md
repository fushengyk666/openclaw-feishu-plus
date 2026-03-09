# Feishu Calendar Skill — 飞书日历能力

**能力范围**
- 查询日历列表
- 读取日历详情
- 查询日历事件（按时间段过滤）
- 创建/更新/删除日历事件
- 查询忙闲状态

**适用场景**
- "我明天有什么会？"
- "帮我预约下周三下午 2 点和产品评审会"
- "把会议 A 改到下周一"
- "看看周三下午我是否空闲"

**使用指南**

查询日程：
> "查我明天的会议"
> "看看这周哪些时间比较忙"

创建日程：
> "帮我约下周五下午 3 点和设计评审"
> "创建会议：主题‘产品迭代会’，时间明天上午 10 点，时长 1 小时"

修改/删除：
> "把下周三的会议改成下午 4 点"
> "取消周三下午的会议"

**身份策略**
- 默认：有用户授权时用用户身份（看到的是你的真实日历），否则回退应用身份
- 忙闲状态查询必须用户身份

**工具列表**
- `feishu_calendar_list`
- `feishu_calendar_get`
- `feishu_calendar_event_list`
- `feishu_calendar_event_create`
- `feishu_calendar_event_update`
- `feishu_calendar_event_delete`
- `feishu_calendar_freebusy`
