import type { Env, AuthContext, ApiResponse } from '../types';
import { validateSession } from '../auth/auth-service';

/**
 * 从请求头提取 token
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return authHeader;
}

/**
 * 创建 JSON 响应
 */
function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 验证用户已登录
 * 返回 AuthContext 或错误响应
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<AuthContext | Response> {
  const token = extractToken(request);

  if (!token) {
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '请先登录',
        },
      },
      401
    );
  }

  const validation = await validateSession(env.DB, token);

  if (!validation) {
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '会话无效或已过期',
        },
      },
      401
    );
  }

  return {
    user: validation.user,
    session: validation.session,
  };
}

/**
 * 验证管理员权限
 * 返回 AuthContext 或错误响应
 */
export async function requireAdmin(
  request: Request,
  env: Env
): Promise<AuthContext | Response> {
  const authResult = await requireAuth(request, env);

  // 如果是 Response，说明认证失败
  if (authResult instanceof Response) {
    return authResult;
  }

  // 检查是否是管理员
  if (authResult.user.role !== 'admin') {
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '需要管理员权限',
        },
      },
      403
    );
  }

  return authResult;
}

/**
 * 判断结果是否是 AuthContext（而非 Response）
 */
export function isAuthContext(result: AuthContext | Response): result is AuthContext {
  return !(result instanceof Response);
}
