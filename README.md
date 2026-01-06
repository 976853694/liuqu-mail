# 临时邮箱系统 (Temp Email System)

基于 Cloudflare Workers 的临时邮箱系统，支持随机生成邮箱地址、接收邮件、自动过期清理。

## 功能特性

- 🎲 随机生成临时邮箱地址
- 📬 接收并存储邮件（纯文本）
- 🔐 访问令牌认证
- ⏰ 可配置的邮件保留时长
- 🧹 自动清理过期数据
- 🌐 REST API + Web 界面
- 🚀 全球边缘部署

## 技术栈

- Cloudflare Workers (运行时)
- Cloudflare D1 (数据库)
- Cloudflare Email Routing (邮件接收)
- postal-mime (邮件解析)

## 部署方式

### 方式一：Cloudflare Dashboard 可视化部署

#### 步骤 1：创建 D1 数据库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧菜单选择 **Workers & Pages** → **D1 SQL Database**
3. 点击 **Create database**
4. 输入数据库名称：`temp-email-db`
5. 点击 **Create**
6. 记录下 **Database ID**（后面需要用到）

#### 步骤 2：初始化数据库表

1. 进入刚创建的数据库
2. 点击 **Console** 标签
3. 复制 `schema.sql` 文件的内容，粘贴到控制台
4. 点击 **Execute** 执行

#### 步骤 3：创建 Worker

1. 左侧菜单选择 **Workers & Pages**
2. 点击 **Create**
3. 选择 **Create Worker**
4. 输入 Worker 名称：`temp-email-system`
5. 点击 **Deploy**（先部署一个空的）

#### 步骤 4：上传代码

1. 进入刚创建的 Worker
2. 点击 **Edit code** 进入在线编辑器
3. 由于 Dashboard 不支持多文件 TypeScript，建议使用命令行部署代码：
   ```bash
   npm install
   npx wrangler deploy
   ```

#### 步骤 5：绑定 D1 数据库

1. 进入 Worker 设置页面
2. 点击 **Settings** → **Bindings**
3. 点击 **Add** → **D1 Database**
4. Variable name 填写：`DB`
5. 选择之前创建的 `temp-email-db`
6. 点击 **Save**

#### 步骤 6：配置环境变量

1. 在 Worker 设置页面
2. 点击 **Settings** → **Variables and Secrets**
3. 添加以下变量：
   - `RETENTION_HOURS` = `24`
   - `RATE_LIMIT_PER_MINUTE` = `60`
   - `EMAIL_DOMAIN` = `你的域名.com`
4. 点击 **Save and deploy**

#### 步骤 7：配置 Email Routing

1. 左侧菜单选择你的域名
2. 点击 **Email** → **Email Routing**
3. 如果未启用，点击 **Get started** 启用
4. 点击 **Routing rules** 标签
5. 点击 **Create address** 或 **Catch-all address**
6. 选择 **Send to a Worker**
7. 选择 `temp-email-system` Worker
8. 点击 **Save**

#### 步骤 8：配置定时任务（Cron Trigger）

1. 进入 Worker 设置页面
2. 点击 **Settings** → **Triggers**
3. 在 **Cron Triggers** 部分点击 **Add**
4. 输入 Cron 表达式：`0 * * * *`（每小时执行一次清理）
5. 点击 **Save**

#### 步骤 9：部署前端（可选）

前端可以部署到 Cloudflare Pages：

1. 左侧菜单选择 **Workers & Pages**
2. 点击 **Create** → **Pages**
3. 选择 **Direct Upload**
4. 上传 `frontend/` 文件夹中的文件
5. 设置自定义域名（可选）

---

### 方式二：命令行部署（推荐）

#### 1. 安装依赖

```bash
npm install
```

#### 2. 登录 Cloudflare

```bash
npx wrangler login
```

#### 3. 创建 D1 数据库

```bash
npx wrangler d1 create temp-email-db
```

将返回的 `database_id` 更新到 `wrangler.toml` 中。

#### 4. 初始化数据库

```bash
npm run db:migrate
```

#### 5. 配置环境变量

编辑 `wrangler.toml`：

```toml
[vars]
RETENTION_HOURS = "24"           # 邮件保留时长（小时）
RATE_LIMIT_PER_MINUTE = "60"     # 每分钟请求限制
EMAIL_DOMAIN = "your-domain.com" # 你的邮箱域名
```

#### 6. 部署

```bash
npm run deploy
```

#### 7. 配置 Email Routing

在 Cloudflare Dashboard 中配置（参考上面步骤 7）

---

### 本地开发

```bash
npm run dev
```

## API 文档

### 创建邮箱

```
POST /api/mailbox
```

响应：
```json
{
  "success": true,
  "data": {
    "address": "abc123xyz@your-domain.com",
    "token": "your-access-token",
    "expiresAt": "2024-01-02T00:00:00.000Z"
  }
}
```

### 获取邮件列表

```
GET /api/mailbox/{address}/emails
Authorization: Bearer {token}
```

### 获取邮件详情

```
GET /api/mailbox/{address}/emails/{id}
Authorization: Bearer {token}
```

## 前端部署

前端文件位于 `frontend/` 目录，可以：

1. 部署到 Cloudflare Pages
2. 或配置 Worker 提供静态文件服务

## 许可证

MIT
