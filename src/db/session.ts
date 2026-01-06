import type { Session } from '../types';
import { generateUUID, generateToken } from '../utils/random';

/**
 * 创建会话输入
 */
export interface CreateSessionInput {
  userId: string;
  expiryHours: number;
}

/**
 * 创建会话
 */
export async function createSession(
  db: D1Database,
  input: CreateSessionInput
): Promise<Session> {
  const id = generateUUID();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiryHours * 60 * 60 * 1000);

  const session: Session = {
    id,
    user_id: input.userId,
    token,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, token, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(session.id, session.user_id, session.token, session.created_at, session.expires_at)
    .run();

  return session;
}

/**
 * 根据 token 查询会话
 */
export async function findSessionByToken(
  db: D1Database,
  token: string
): Promise<Session | null> {
  const result = await db
    .prepare('SELECT * FROM sessions WHERE token = ?')
    .bind(token)
    .first<Session>();

  return result || null;
}

/**
 * 根据 token 查询有效会话（未过期）
 */
export async function findValidSessionByToken(
  db: D1Database,
  token: string
): Promise<Session | null> {
  const now = new Date().toISOString();
  const result = await db
    .prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?')
    .bind(token, now)
    .first<Session>();

  return result || null;
}

/**
 * 删除会话
 */
export async function deleteSession(
  db: D1Database,
  token: string
): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

/**
 * 删除用户所有会话
 */
export async function deleteSessionsByUserId(
  db: D1Database,
  userId: string
): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}

/**
 * 清理过期会话
 */
export async function deleteExpiredSessions(db: D1Database): Promise<number> {
  const now = new Date().toISOString();
  const result = await db
    .prepare('DELETE FROM sessions WHERE expires_at < ?')
    .bind(now)
    .run();

  return result.meta.changes || 0;
}
