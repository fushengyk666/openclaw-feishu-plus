# Feishu Drive Assistant — 飞书云盘工作流增强

**能力范围**
- 列出文件/文件夹
- 获取文件信息与下载链接
- 创建文件夹
- 文件复制/移动/删除
- 权限管理（查看/授权/撤销/转移所有权）
- 文件上传准备
- 文件归档与整理工作流

**适用场景**
- "列出我云盘根目录的文件"
- "帮我在云盘创建一个'项目文档'文件夹"
- "把文件 xxx 移动到文件夹 yyy"
- "给用户 zzz 共享文件 xxx 的编辑权限"
- "帮我整理一下这个文件夹，按类型分类"

**使用指南**

### 浏览文件
> "列出云盘根目录的文件"
> "列出文件夹 xxx 下的所有文件"
> "获取文件 xxx 的详细信息"

### 文件操作
> "创建一个文件夹叫'2024年报告'"
> "把文件 xxx 复制到文件夹 yyy"
> "把文件 xxx 移动到文件夹 yyy"
> "删除文件 xxx"

### 权限管理
> "查看文件 xxx 的共享权限"
> "给用户 ou_xxx 分享文件 xxx 的编辑权限"
> "撤销用户 ou_xxx 对文件 xxx 的权限"
> "把文件 xxx 的所有权转给 ou_yyy"（需要用户授权）

### 文件整理工作流
1. 用 `feishu_plus_drive_list_files` 列出目录
2. 根据文件类型/时间/名称分类
3. 用 `feishu_plus_drive_create_folder` 创建目标文件夹
4. 用 `feishu_plus_drive_move_file` 移动文件
5. 用 `feishu_plus_drive_create_permission` 设置权限

**身份策略**
- 大部分操作支持应用/用户双身份
- **转移所有权**（transfer_owner）必须用户身份

**工具列表 — 文件操作**
| 工具名 | 说明 |
|--------|------|
| `feishu_plus_drive_list_files` | 列出文件 |
| `feishu_plus_drive_get_file` | 获取文件信息 |
| `feishu_plus_drive_download_file` | 获取下载信息 |
| `feishu_plus_drive_upload_file` | 上传文件（准备） |
| `feishu_plus_drive_create_folder` | 创建文件夹 |
| `feishu_plus_drive_delete_file` | 删除文件 |
| `feishu_plus_drive_copy_file` | 复制文件 |
| `feishu_plus_drive_move_file` | 移动文件 |

**工具列表 — 权限管理**
| 工具名 | 说明 | 身份要求 |
|--------|------|----------|
| `feishu_plus_drive_list_permissions` | 列出权限 | 均可 |
| `feishu_plus_drive_create_permission` | 添加权限 | 均可 |
| `feishu_plus_drive_update_permission` | 更新权限 | 均可 |
| `feishu_plus_drive_delete_permission` | 删除权限 | 均可 |
| `feishu_plus_drive_transfer_owner` | 转移所有权 | 仅用户 |

**注意事项**
- 文件类型标识：file / doc / docx / bitable / sheet / mindnote / slides
- `folder_token` 为空时表示根目录
- 权限级别：view / edit / full_access
- 权限成员类型：user / group / org
