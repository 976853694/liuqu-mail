# 📧 临时邮箱 API 文档

Base URL: `https://your-worker.workers.dev`

## 接口列表

### 认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |

### 用户接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/profile` | 获取用户信息 |
| PUT | `/api/user/password` | 修改密码 |
| PUT | `/api/user/username` | 修改用户名 |

### 邮箱接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/mailbox` | 创建临时邮箱 |
| GET | `/api/mailboxes` | 获取我的邮箱列表 |
| DELETE | `/api/mailbox/{id}` | 删除邮箱 |
| GET | `/api/mailbox/{address}/emails` | 获取邮件列表 |
| GET | `/api/mailbox/{address}/emails/{id}` | 获取邮件详情 |

### 管理员接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/stats` | 获取系统统计 |
| GET | `/api/admin/users` | 获取用户列表 |
| PUT | `/api/admin/users/{id}/status` | 更新用户状态 |
| DELETE | `/api/admin/users/{id}` | 删除用户 |
| GET | `/api/admin/mailboxes` | 获取所有邮箱 |
| DELETE | `/api/admin/mailboxes/{id}` | 删除邮箱 |

### 调试接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/debug/init` | 检查环境变量并创建管理员 |
| POST | `/api/debug/setup-admin` | 手动设置管理员账户 |

---

## 认证接口

### 1. 用户注册

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "myuser",
  "password": "mypassword"
}
```

**验证规则**：用户名和密码至少6位

**成功响应 (201)**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "myuser",
    "role": "user",
    "status": "active",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. 用户登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "myuser",
  "password": "mypassword"
}
```

**成功响应 (200)**
```json
{
  "success": true,
  "data": {
    "token": "session-token",
    "user": {
      "id": "uuid",
      "username": "myuser",
      "role": "user"
    },
    "expiresAt": "2024-01-02T00:00:00.000Z"
  }
}
```

### 3. 用户登出

```http
POST /api/auth/logout
Authorization: Bearer {token}
```

**成功响应 (200)**
```json
{
  "success": true
}
```

---

## 用户接口

### 4. 获取用户信息

```http
GET /api/user/profile
Authorization: Bearer {token}
```

**成功响应 (200)**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "myuser",
    "role": "user",
    "created_at": "2024-01-01T00:00:00.000Z",
    "mailboxCount": 3
  }
}
```

### 5. 修改密码

```http
PUT /api/user/password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

**验证规则**：新密码至少6位

**成功响应 (200)**
```json
{
  "success": true
}
```

### 6. 修改用户名

```http
PUT /api/user/username
Authorization: Bearer {token}
Content-Type: application/json

{
  "newUsername": "newusername"
}
```

**验证规则**：新用户名至少6位，且不能与现有用户名重复

**成功响应 (200)**
```json
{
  "success": true
}
```

**错误响应 (409)**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "用户名已被使用"
  }
}
```

---

## 邮箱接口

### 7. 创建临时邮箱

```http
POST /api/mailbox
Authorization: Bearer {token}
```

**成功响应 (201)**
```json
{
  "success": true,
  "data": {
    "address": "abc123xyz@example.com",
    "token": "mailbox-token",
    "expiresAt": "2024-01-02T12:00:00.000Z"
  }
}
```

### 8. 获取我的邮箱列表

```http
GET /api/mailboxes
Authorization: Bearer {token}
```

**成功响应 (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "address": "abc123xyz@example.com",
      "created_at": "2024-01-01T00:00:00.000Z",
      "expires_at": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

### 9. 删除邮箱

```http
DELETE /api/mailbox/{id}
Authorization: Bearer {token}
```

### 10. 获取邮件列表

```http
GET /api/mailbox/{address}/emails
Authorization: Bearer {token}
```

### 11. 获取邮件详情

```http
GET /api/mailbox/{address}/emails/{id}
Authorization: Bearer {token}
```

---

## 调试接口

### 12. 手动设置管理员账户

用于首次部署时手动创建管理员账户。

```http
POST /api/debug/setup-admin
Content-Type: application/json

{
  "username": "admin123",
  "password": "admin123456"
}
```

**验证规则**：用户名和密码至少6位

**成功响应 (201)** - 创建新管理员
```json
{
  "success": true,
  "data": {
    "message": "管理员创建成功",
    "username": "admin123",
    "id": "uuid"
  }
}
```

**成功响应 (200)** - 更新现有管理员密码
```json
{
  "success": true,
  "data": {
    "message": "管理员密码已更新",
    "username": "admin123"
  }
}
```

---

## 错误码说明

| HTTP 状态码 | 错误码 | 说明 |
|------------|--------|------|
| 400 | `BAD_REQUEST` | 请求参数无效 |
| 401 | `UNAUTHORIZED` | 缺少或无效的访问令牌 |
| 403 | `FORBIDDEN` | 无权限访问 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `CONFLICT` | 资源冲突（如用户名已存在） |
| 429 | `RATE_LIMITED` | 请求过于频繁 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 注意事项

1. **认证方式**：除注册和登录外，所有接口都需要 `Authorization: Bearer {token}` 头
2. **验证规则**：用户名和密码只需6位以上，无复杂要求
3. **邮箱过期**：邮箱会在过期时间后自动删除
4. **速率限制**：默认每分钟 60 次请求
