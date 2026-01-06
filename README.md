# 📧 临时邮箱 (Temp Mail)

基于 Cloudflare Workers 的免费临时邮箱系统，一键部署，无需服务器。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/976853694/liuqu-mail)

## ✨ 功能特性

- 🎲 随机生成临时邮箱地址
- 📬 实时接收邮件
- 🔐 访问令牌认证，保护隐私
- ⏰ 可配置邮件保留时长
- 🧹 自动清理过期数据
- 📱 响应式设计，支持手机访问
- 🆓 完全免费，基于 Cloudflare 免费套餐

## 🚀 一键部署

### 前置要求

- 一个 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)
- 一个已添加到 Cloudflare 的域名（用于接收邮件）

### 部署步骤

#### 第一步：Fork 仓库

点击右上角 **Fork** 按钮，将仓库复制到你的 GitHub 账号。

#### 第二步：创建 D1 数据库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧菜单选择 **Workers & Pages** → **D1 SQL Database**
3. 点击 **Create database**
4. 数据库名称填写：`temp-email-db`
5. 点击 **Create**
6. 📝 **记录下 Database ID**（页面上会显示）

#### 第三步：初始化数据库

1. 进入刚创建的数据库页面
2. 点击 **Console** 标签
3. 复制以下 SQL 并粘贴到控制台：

```sql
CREATE TABLE IF NOT EXISTS mailboxes (
  id TEXT PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);
CREATE INDEX IF NOT EXISTS idx_mailboxes_expires_at ON mailboxes(expires_at);
CREATE INDEX IF NOT EXISTS idx_mailboxes_token ON mailboxes(token);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  received_at TEXT NOT NULL,
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);
```

4. 点击 **Execute** 执行

#### 第四步：创建 Cloudflare API Token

1. 进入 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 **Create Token**
3. 选择 **Edit Cloudflare Workers** 模板
4. 点击 **Continue to summary** → **Create Token**
5. 📝 **复制并保存 Token**（只显示一次！）

#### 第五步：配置 GitHub Secrets

1. 进入你 Fork 的仓库
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**，添加以下 Secrets：

| Name | Value | 说明 |
|------|-------|------|
| `CLOUDFLARE_API_TOKEN` | 你的 API Token | 第四步创建的 Token |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Account ID | Dashboard 右侧栏 → Account ID |
| `D1_DATABASE_ID` | 数据库 ID | 第二步记录的 Database ID |
| `EMAIL_DOMAIN` | 你的域名 | 例如 `example.com` |

> 💡 所有敏感信息都通过 Secrets 配置，无需修改代码文件！

#### 第六步：触发部署

配置完 Secrets 后，有两种方式触发部署：

**方式 1**：手动触发
1. 进入仓库的 **Actions** 标签
2. 选择 **Deploy to Cloudflare Workers**
3. 点击 **Run workflow**

**方式 2**：推送代码触发
- 对仓库做任意修改并推送，会自动触发部署

#### 第七步：配置 Email Routing

1. 在 Cloudflare Dashboard 选择你的域名
2. 点击 **Email** → **Email Routing**
3. 如果未启用，点击 **Enable Email Routing** 并按提示添加 DNS 记录
4. 点击 **Routing rules** → **Catch-all address**
5. 选择 **Send to a Worker**
6. 选择 `temp-email-system`
7. 点击 **Save**

#### 第八步：部署前端（可选）

前端可以单独部署到 Cloudflare Pages：

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 选择你 Fork 的仓库
3. 配置：
   - **Root directory (advanced)**: `frontend`
   - **Build command**: 留空
   - **Build output directory**: 留空
4. 点击 **Save and Deploy**
5. 部署完成后，编辑 `frontend/app.js`，将 `API_BASE` 改为你的 Worker URL：
   ```javascript
   const API_BASE = 'https://temp-email-system.你的用户名.workers.dev/api';
   ```

### 🎉 完成！

访问你的 Worker URL 或 Pages URL 即可使用临时邮箱。

---

## 📖 API 文档

### 创建邮箱

```http
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

```http
GET /api/mailbox/{address}/emails
Authorization: Bearer {token}
```

### 获取邮件详情

```http
GET /api/mailbox/{address}/emails/{id}
Authorization: Bearer {token}
```

---

## ⚙️ 配置说明

在 `wrangler.toml` 中可以修改以下配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `RETENTION_HOURS` | 邮件保留时长（小时） | 24 |
| `RATE_LIMIT_PER_MINUTE` | 每分钟请求限制 | 60 |
| `EMAIL_DOMAIN` | 邮箱域名 | - |

---

## 🛠️ 本地开发

```bash
# 安装依赖
npm install

# 本地运行
npm run dev

# 部署
npm run deploy
```

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [postal-mime](https://github.com/postalsys/postal-mime)
