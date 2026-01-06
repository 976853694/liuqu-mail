import type { Env, UserPublic, Session, SessionValidation, LoginResponse } from '../types';
import { validateUsername, validatePassword } from './validation';
import { hashPassword, verifyPassword } from './password';
import { createUser, findUserByUsername, findUserById, toUserPublic } from '../db/user';
import { createSession, findValidSessionByToken, deleteSession, deleteSessionsByUserId } from '../db/session';

/**
 * 注册结果
 */
export interface RegisterResult {
  success: boolean;
  user?: UserPublic;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/**
 * 登录结果
 */
export interface LoginResult {
  success: boolean;
  data?: LoginResponse;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 用户注册
 */
export async function register(
  db: D1Database,
  username: string,
  password: string,
  allowRegistration: boolean
): Promise<RegisterResult> {
  // 检查是否允许注册
  if (!allowRegistration) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: '注册功能已关闭',
      },
    };
  }

  // 验证输入
  const usernameValidation = validateUsername(username);
  const passwordValidation = validatePassword(password);

  if (!usernameValidation.valid || !passwordValidation.valid) {
    return {
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: '输入验证失败',
        details: {
          username: usernameValidation.errors,
          password: passwordValidation.errors,
        },
      },
    };
  }

  // 检查用户名是否已存在
  const existingUser = await findUserByUsername(db, username);
  if (existingUser) {
    return {
      success: false,
      error: {
        code: 'CONFLICT',
        message: '用户名已存在',
      },
    };
  }

  // 哈希密码并创建用户
  const passwordHash = await hashPassword(password);
  const user = await createUser(db, {
    username,
    passwordHash,
    role: 'user',
  });

  return {
    success: true,
    user: toUserPublic(user),
  };
}

/**
 * 用户登录
 */
export async function login(
  db: D1Database,
  username: string,
  password: string,
  sessionExpiryHours: number
): Promise<LoginResult> {
  // 查找用户
  const user = await findUserByUsername(db, username);
  if (!user) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户名或密码错误',
      },
    };
  }

  // 检查用户状态
  if (user.status === 'disabled') {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: '账户已被禁用',
      },
    };
  }

  // 验证密码
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户名或密码错误',
      },
    };
  }

  // 创建会话
  const session = await createSession(db, {
    userId: user.id,
    expiryHours: sessionExpiryHours,
  });

  return {
    success: true,
    data: {
      token: session.token,
      user: toUserPublic(user),
      expiresAt: session.expires_at,
    },
  };
}

/**
 * 用户登出（幂等）
 */
export async function logout(db: D1Database, token: string): Promise<void> {
  await deleteSession(db, token);
}

/**
 * 验证会话
 */
export async function validateSession(
  db: D1Database,
  token: string
): Promise<SessionValidation | null> {
  // 查找有效会话
  const session = await findValidSessionByToken(db, token);
  if (!session) {
    return null;
  }

  // 查找用户
  const user = await findUserById(db, session.user_id);
  if (!user) {
    return null;
  }

  // 检查用户状态
  if (user.status === 'disabled') {
    return null;
  }

  return {
    user: toUserPublic(user),
    session,
  };
}

/**
 * 使用户所有会话失效
 */
export async function invalidateUserSessions(
  db: D1Database,
  userId: string
): Promise<void> {
  await deleteSessionsByUserId(db, userId);
}

/**
 * 获取环境配置的辅助函数
 */
export function getAuthConfig(env: Env) {
  return {
    allowRegistration: env.ALLOW_REGISTRATION !== 'false',
    maxMailboxesPerUser: parseInt(env.MAX_MAILBOXES_PER_USER || '5'),
    sessionExpiryHours: parseInt(env.SESSION_EXPIRY_HOURS || '24'),
  };
}
