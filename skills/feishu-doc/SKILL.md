# Feishu Doc Skill — 飞书云文档能力

**能力范围**
- 创建文档
- 读取文档内容（含纯文本与块）
- 编辑文档（创建/更新/删除块）
- 列出文档块

**适用场景**
- 快速创建草稿
- 生成周报/会议纪要
- 文档模板化

**使用指南**

创建文档：
> "帮我创建一个文档，标题是‘周报模板’，里面包含本周工作总结和下周计划"

读取文档：
> "获取文档 xxx 的内容并总结"

编辑文档：
> "在文档 xxx 中加入一条内容：完成项目 A"

批量操作：
> "把明天的会议整理成一个文档，每条会议作为一个段落"

**身份策略**
- 默认：有用户授权时用用户身份，否则用应用身份
- 工具层自动处理 token 选择，无需手动指定

**工具列表**
- `feishu_doc_create`
- `feishu_doc_get`
- `feishu_doc_get_raw`
- `feishu_doc_list_blocks`
- `feishu_doc_create_block`
- `feishu_doc_update_block`
- `feishu_doc_delete_block`
