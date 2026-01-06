# 📧 临时邮箱 (Temp Mail)

基于 Cloudflare Workers 的免费临时邮箱系统，支持用户注册登录和管理员后台，一键部署，无需服务器。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/976853694/liuqu-mail)

## ✨ 功能特性

- 👤 用户注册/登录系统
- 🔐 管理员后台（用户管理、邮箱管理、系统统计）
- 🎲 随机生成临时邮箱地址
- 📬 实时接收邮件
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

1. 登录 [Cloudflare 管理后台](https://dash.cloudflare.com)
2. 左侧菜单选择 **Workers & Pages** → **D1 SQL Database**
3. 点击 **Create database**
4. 数据库名称填写：`temp-email-db`
5. 点击 **Create**
6. 📝 **记录下 Database ID**（类似 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）

> ⚠️ **注意**：数据库表结构会在首次部署时自动创建，无需手动执行 SQL！

#### 第三步：获取 Cloudflare API 凭证

1. 进入 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 找到 **Global API Key**，点击 **View** 并验证身份
3. 📝 **复制并保存 Global API Key**

#### 第四步：配置 GitHub Secrets

1. 进入你 Fork 的仓库
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**，添加以下 Secrets：

| Name | Value | 说明 |
|------|-------|------|
| `CLOUDFLARE_GLOBAL_API_KEY` | 全局 API Key | 用于部署和数据库初始化 |
| `CLOUDFLARE_EMAIL` | Cloudflare 账户邮箱 | 与全局 Key 配合使用 |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Account ID | 见下方说明 ⬇️ |
| `D1_DATABASE_ID` | 数据库 ID | 第二步记录的 Database ID |
| `EMAIL_DOMAIN` | 你的域名 | 例如 `example.com` |
| `ADMIN_USERNAME` | 管理员用户名 | 首次部署自动创建 |
| `ADMIN_PASSWORD` | 管理员密码 | 至少8位，含字母和数字 |

**如何找到 Account ID：**
1. 登录 https://dash.cloudflare.com
2. 点击左侧菜单 **Workers & Pages**
3. 在页面**右侧边栏**可以看到 **Account ID**

#### 第五步：触发部署

配置完 Secrets 后，有两种方式触发部署：

**方式 1**：手动触发
1. 进入仓库的 **Actions** 标签
2. 选择 **Deploy to Cloudflare Workers**
3. 点击 **Run workflow**

**方式 2**：推送代码触发
- 对仓库做任意修改并推送，会自动触发部署

> 🎉 部署时会自动：
> - 初始化数据库表结构
> - 创建管理员账户
> - 部署 Worker

#### 第六步：配置 Email Routing

1. 在 [Cloudflare 管理后台](https://dash.cloudflare.com) 选择你的域名
2. 点击 **Email** → **Email Routing**
3. 如果未启用，点击 **Enable Email Routing** 并按提示添加 DNS 记录
4. 点击 **Routing rules** → **Catch-all address**
5. 选择 **Send to a Worker**
6. 选择 `temp-email-system`
7. 点击 **Save**

### 🎉 完成！

访问你的 Worker URL 即可使用临时邮箱：
- 普通用户：注册登录后创建邮箱
- 管理员：使用配置的管理员账户登录，可访问管理后台

#### 手动创建管理员账户

如果管理员账户没有自动创建，可以访问以下地址手动创建：

```
https://你的域名/api/debug/init
```

成功后会返回：
```json
{"success":true,"data":{"message":"管理员创建成功","username":"admin","id":"xxx"}}
```

---

## 📖 API 文档

详细 API 文档请参考 [API.md](./API.md)

### 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/logout | 用户登出 |

### 用户相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/user/profile | 获取用户资料 |
| PUT | /api/user/password | 修改密码 |

### 邮箱相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/mailbox | 创建邮箱 |
| GET | /api/mailboxes | 获取邮箱列表 |
| DELETE | /api/mailbox/:id | 删除邮箱 |
| GET | /api/mailbox/:address/emails | 获取邮件列表 |
| GET | /api/mailbox/:address/emails/:id | 获取邮件详情 |

### 管理员相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/stats | 系统统计 |
| GET | /api/admin/users | 用户列表 |
| PUT | /api/admin/users/:id/status | 更新用户状态 |
| DELETE | /api/admin/users/:id | 删除用户 |
| GET | /api/admin/mailboxes | 邮箱列表 |
| DELETE | /api/admin/mailboxes/:id | 删除邮箱 |

---

## ⚙️ 配置说明

在 `wrangler.toml` 中可以修改以下配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `RETENTION_HOURS` | 邮件保留时长（小时） | 24 |
| `RATE_LIMIT_PER_MINUTE` | 每分钟请求限制 | 60 |
| `EMAIL_DOMAIN` | 邮箱域名 | - |
| `ALLOW_REGISTRATION` | 是否开放注册 | true |
| `MAX_MAILBOXES_PER_USER` | 每用户最大邮箱数 | 5 |
| `SESSION_EXPIRY_HOURS` | 会话过期时间（小时） | 24 |

---

## 🛠️ 本地开发

```bash
# 安装依赖
npm install

# 创建本地数据库
npx wrangler d1 create temp-email-db --local
npx wrangler d1 execute temp-email-db --local --file=schema.sql

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
