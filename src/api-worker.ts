import type { Env, ApiResponse, CreateMailboxResponse, EmailSummary, EmailDetail } from './types';
import { createMailbox, validateMailboxAccess, getMailboxByAddress } from './db/mailbox';
import { getEmailsByMailbox, getEmailById } from './db/email';

// 速率限制存储 (简单实现，生产环境建议使用 KV 或 Durable Objects)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * 处理 API 请求
 */
export async function handleApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检请求
  if (request.method === 'OPTIONS') {
    return corsResponse(new Response(null, { status: 204 }));
  }

  // 速率限制检查
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitResult = checkRateLimit(clientIP, parseInt(env.RATE_LIMIT_PER_MINUTE || '60'));
  if (!rateLimitResult.allowed) {
    return corsResponse(jsonResponse<ApiResponse>(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      429
    ));
  }

  try {
    // 路由处理
    if (path === '/api/mailbox' && request.method === 'POST') {
      return corsResponse(await handleCreateMailbox(env));
    }

    const emailListMatch = path.match(/^\/api\/mailbox\/([^/]+)\/emails$/);
    if (emailListMatch && request.method === 'GET') {
      const address = decodeURIComponent(emailListMatch[1]);
      return corsResponse(await handleGetEmails(request, env, address));
    }

    const emailDetailMatch = path.match(/^\/api\/mailbox\/([^/]+)\/emails\/([^/]+)$/);
    if (emailDetailMatch && request.method === 'GET') {
      const address = decodeURIComponent(emailDetailMatch[1]);
      const emailId = emailDetailMatch[2];
      return corsResponse(await handleGetEmailDetail(request, env, address, emailId));
    }

    // 静态文件请求交给前端处理
    if (!path.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 });
    }

    return corsResponse(jsonResponse<ApiResponse>(
      { success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
      404
    ));
  } catch (error) {
    console.error('API Error:', error);
    return corsResponse(jsonResponse<ApiResponse>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      500
    ));
  }
}

/**
 * 创建邮箱
 */
async function handleCreateMailbox(env: Env): Promise<Response> {
  const retentionHours = parseInt(env.RETENTION_HOURS || '24');
  const mailbox = await createMailbox(env.DB, env.EMAIL_DOMAIN, retentionHours);

  const response: CreateMailboxResponse = {
    address: mailbox.address,
    token: mailbox.token,
    expiresAt: mailbox.expires_at,
  };

  return jsonResponse<ApiResponse<CreateMailboxResponse>>({
    success: true,
    data: response,
  }, 201);
}

/**
 * 获取邮件列表
 */
async function handleGetEmails(
  request: Request,
  env: Env,
  address: string
): Promise<Response> {
  const token = extractToken(request);
  if (!token) {
    return jsonResponse<ApiResponse>(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' } },
      401
    );
  }

  const mailbox = await validateMailboxAccess(env.DB, address, token);
  if (!mailbox) {
    return jsonResponse<ApiResponse>(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token or mailbox not found' } },
      401
    );
  }

  const emails = await getEmailsByMailbox(env.DB, mailbox.id);

  return jsonResponse<ApiResponse<{ emails: EmailSummary[] }>>({
    success: true,
    data: { emails },
  });
}

/**
 * 获取邮件详情
 */
async function handleGetEmailDetail(
  request: Request,
  env: Env,
  address: string,
  emailId: string
): Promise<Response> {
  const token = extractToken(request);
  if (!token) {
    return jsonResponse<ApiResponse>(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' } },
      401
    );
  }

  const mailbox = await validateMailboxAccess(env.DB, address, token);
  if (!mailbox) {
    return jsonResponse<ApiResponse>(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token or mailbox not found' } },
      401
    );
  }

  const email = await getEmailById(env.DB, emailId, mailbox.id);
  if (!email) {
    return jsonResponse<ApiResponse>(
      { success: false, error: { code: 'NOT_FOUND', message: 'Email not found' } },
      404
    );
  }

  return jsonResponse<ApiResponse<EmailDetail>>({
    success: true,
    data: email,
  });
}

/**
 * 从请求头提取令牌
 */
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return authHeader;
}

/**
 * 检查速率限制
 */
function checkRateLimit(key: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 分钟窗口
  
  let entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitMap.set(key, entry);
  }
  
  entry.count++;
  
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
  };
}

/**
 * JSON 响应
 */
function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 添加 CORS 头
 */
function corsResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
