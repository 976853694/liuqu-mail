# 📧 临时邮箱 API 文档

Base URL: `https://your-worker.workers.dev`

## 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/mailbox` | 创建临时邮箱 |
| GET | `/api/mailbox/{address}/emails` | 获取邮件列表 |
| GET | `/api/mailbox/{address}/emails/{id}` | 获取邮件详情 |

---

## 1. 创建临时邮箱

创建一个新的临时邮箱地址。

### 请求

```http
POST /api/mailbox
```

无需请求体。

### 响应

**成功 (201)**

```json
{
  "success": true,
  "data": {
    "address": "abc123xyz@example.com",
    "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "expiresAt": "2024-01-02T12:00:00.000Z"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `address` | string | 生成的临时邮箱地址 |
| `token` | string | 访问令牌，用于后续 API 调用认证 |
| `expiresAt` | string | 邮箱过期时间 (ISO 8601 格式) |

**错误 (429)**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests"
  }
}
```

### 示例

```bash
curl -X POST https://your-worker.workers.dev/api/mailbox
```

```javascript
const response = await fetch('https://your-worker.workers.dev/api/mailbox', {
  method: 'POST'
});
const result = await response.json();
console.log(result.data.address); // abc123xyz@example.com
console.log(result.data.token);   // 保存这个 token 用于后续请求
```

---

## 2. 获取邮件列表

获取指定邮箱收到的所有邮件列表，按接收时间倒序排列。

### 请求

```http
GET /api/mailbox/{address}/emails
Authorization: Bearer {token}
```

| 参数 | 位置 | 说明 |
|------|------|------|
| `address` | URL 路径 | 邮箱地址 (需要 URL 编码) |
| `token` | Header | 创建邮箱时返回的访问令牌 |

### 响应

**成功 (200)**

```json
{
  "success": true,
  "data": {
    "emails": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "from": "noreply@github.com",
        "subject": "Please verify your email",
        "receivedAt": "2024-01-01T10:30:00.000Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "from": "support@example.com",
        "subject": "Welcome!",
        "receivedAt": "2024-01-01T09:00:00.000Z"
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `emails` | array | 邮件列表 |
| `emails[].id` | string | 邮件 ID |
| `emails[].from` | string | 发件人地址 |
| `emails[].subject` | string \| null | 邮件主题 |
| `emails[].receivedAt` | string | 接收时间 (ISO 8601 格式) |

**错误 (401)**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid token or mailbox not found"
  }
}
```

### 示例

```bash
curl -H "Authorization: Bearer your-token-here" \
  "https://your-worker.workers.dev/api/mailbox/abc123xyz%40example.com/emails"
```

```javascript
const response = await fetch(
  `https://your-worker.workers.dev/api/mailbox/${encodeURIComponent(address)}/emails`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const result = await response.json();
console.log(result.data.emails);
```

---

## 3. 获取邮件详情

获取指定邮件的完整内容。

### 请求

```http
GET /api/mailbox/{address}/emails/{id}
Authorization: Bearer {token}
```

| 参数 | 位置 | 说明 |
|------|------|------|
| `address` | URL 路径 | 邮箱地址 (需要 URL 编码) |
| `id` | URL 路径 | 邮件 ID |
| `token` | Header | 创建邮箱时返回的访问令牌 |

### 响应

**成功 (200)**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "from": "noreply@github.com",
    "to": "abc123xyz@example.com",
    "subject": "Please verify your email",
    "body": "Click the link below to verify your email address:\n\nhttps://github.com/verify?token=xxx",
    "receivedAt": "2024-01-01T10:30:00.000Z"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 邮件 ID |
| `from` | string | 发件人地址 |
| `to` | string | 收件人地址 |
| `subject` | string \| null | 邮件主题 |
| `body` | string \| null | 邮件正文 (纯文本) |
| `receivedAt` | string | 接收时间 (ISO 8601 格式) |

**错误 (404)**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Email not found"
  }
}
```

### 示例

```bash
curl -H "Authorization: Bearer your-token-here" \
  "https://your-worker.workers.dev/api/mailbox/abc123xyz%40example.com/emails/550e8400-e29b-41d4-a716-446655440000"
```

```javascript
const response = await fetch(
  `https://your-worker.workers.dev/api/mailbox/${encodeURIComponent(address)}/emails/${emailId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const result = await response.json();
console.log(result.data.body);
```

---

## 错误码说明

| HTTP 状态码 | 错误码 | 说明 |
|------------|--------|------|
| 400 | `BAD_REQUEST` | 请求参数无效 |
| 401 | `UNAUTHORIZED` | 缺少或无效的访问令牌 |
| 404 | `NOT_FOUND` | 邮箱或邮件不存在 |
| 429 | `RATE_LIMITED` | 请求过于频繁，请稍后重试 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 使用流程

```
1. POST /api/mailbox          → 获取邮箱地址和 token
2. 使用邮箱地址注册/验证
3. GET /api/mailbox/{address}/emails  → 轮询获取邮件列表
4. GET /api/mailbox/{address}/emails/{id}  → 查看邮件详情
```

---

## 注意事项

1. **Token 保密**：访问令牌是访问邮箱的唯一凭证，请妥善保管
2. **邮箱过期**：邮箱会在 `expiresAt` 时间后自动删除
3. **速率限制**：默认每分钟 60 次请求
4. **不支持附件**：系统只保存邮件的纯文本内容
5. **URL 编码**：邮箱地址中的 `@` 符号需要编码为 `%40`
