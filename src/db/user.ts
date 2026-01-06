import type { User, UserPublic, UserStatus, UserRole, PaginatedResult } from '../types';
import { generateUUID } from '../utils/random';

/**
 * 创建用户输入
 */
export interface CreateUserInput {
  username: string;
  passwordHash: string;
  role?: UserRole;
}

/**
 * 创建用户
 */
export async function createUser(
  db: D1Database,
  input: CreateUserInput
): Promise<User> {
  const id = generateUUID();
  const now = new Date().toISOString();
  const role = input.role || 'user';

  const user: User = {
    id,
    username: input.username,
    password_hash: input.passwordHash,
    role,
    status: 'active',
    created_at: now,
  };

  await db
    .prepare(
      `INSERT INTO users (id, username, password_hash, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(user.id, user.username, user.password_hash, user.role, user.status, user.created_at)
    .run();

  return user;
}

/**
 * 根据用户名查询用户
 */
export async function findUserByUsername(
  db: D1Database,
  username: string
): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .first<User>();

  return result || null;
}

/**
 * 根据 ID 查询用户
 */
export async function findUserById(
  db: D1Database,
  id: string
): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();

  return result || null;
}

/**
 * 更新用户状态
 */
export async function updateUserStatus(
  db: D1Database,
  id: string,
  status: UserStatus
): Promise<void> {
  await db
    .prepare('UPDATE users SET status = ? WHERE id = ?')
    .bind(status, id)
    .run();
}

/**
 * 更新用户密码
 */
export async function updateUserPassword(
  db: D1Database,
  id: string,
  passwordHash: string
): Promise<void> {
  await db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(passwordHash, id)
    .run();
}

/**
 * 更新用户名
 */
export async function updateUsername(
  db: D1Database,
  id: string,
  username: string
): Promise<void> {
  await db
    .prepare('UPDATE users SET username = ? WHERE id = ?')
    .bind(username, id)
    .run();
}

/**
 * 删除用户
 */
export async function deleteUser(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
}

/**
 * 获取用户列表（分页）
 */
export async function listUsers(
  db: D1Database,
  page: number,
  pageSize: number
): Promise<PaginatedResult<UserPublic>> {
  const offset = (page - 1) * pageSize;

  const countResult = await db
    .prepare('SELECT COUNT(*) as count FROM users')
    .first<{ count: number }>();
  const total = countResult?.count || 0;

  const result = await db
    .prepare(
      `SELECT id, username, role, status, created_at 
       FROM users 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`
    )
    .bind(pageSize, offset)
    .all<UserPublic>();

  return {
    items: result.results || [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取用户数量
 */
export async function countUsers(db: D1Database): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM users')
    .first<{ count: number }>();

  return result?.count || 0;
}

/**
 * 获取活跃用户数量
 */
export async function countActiveUsers(db: D1Database): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'")
    .first<{ count: number }>();

  return result?.count || 0;
}

/**
 * 检查是否存在管理员用户
 */
export async function hasAdminUser(db: D1Database): Promise<boolean> {
  const result = await db
    .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
    .first<{ count: number }>();

  return (result?.count || 0) > 0;
}

/**
 * 将 User 转换为 UserPublic（移除密码）
 */
export function toUserPublic(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
  };
}
