import type { Mailbox, MailboxWithOwner, PaginatedResult } from '../types';
import { generateUUID, generateEmailAddress, generateToken } from '../utils/random';

/**
 * 创建新邮箱（关联用户）
 */
export async function createMailbox(
  db: D1Database,
  domain: string,
  retentionHours: number,
  userId?: string
): Promise<Mailbox> {
  const id = generateUUID();
  const address = generateEmailAddress(domain);
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + retentionHours * 60 * 60 * 1000);

  const mailbox: Mailbox = {
    id,
    address,
    token,
    user_id: userId || null,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  await db
    .prepare(
      `INSERT INTO mailboxes (id, address, token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(mailbox.id, mailbox.address, mailbox.token, mailbox.user_id, mailbox.created_at, mailbox.expires_at)
    .run();

  return mailbox;
}

/**
 * 根据地址查询邮箱
 */
export async function getMailboxByAddress(
  db: D1Database,
  address: string
): Promise<Mailbox | null> {
  const result = await db
    .prepare('SELECT * FROM mailboxes WHERE address = ?')
    .bind(address)
    .first<Mailbox>();

  return result || null;
}

/**
 * 根据 ID 查询邮箱
 */
export async function getMailboxById(
  db: D1Database,
  id: string
): Promise<Mailbox | null> {
  const result = await db
    .prepare('SELECT * FROM mailboxes WHERE id = ?')
    .bind(id)
    .first<Mailbox>();

  return result || null;
}

/**
 * 根据令牌查询邮箱
 */
export async function getMailboxByToken(
  db: D1Database,
  token: string
): Promise<Mailbox | null> {
  const result = await db
    .prepare('SELECT * FROM mailboxes WHERE token = ?')
    .bind(token)
    .first<Mailbox>();

  return result || null;
}

/**
 * 验证邮箱访问权限（通过地址和令牌）
 */
export async function validateMailboxAccess(
  db: D1Database,
  address: string,
  token: string
): Promise<Mailbox | null> {
  const result = await db
    .prepare('SELECT * FROM mailboxes WHERE address = ? AND token = ?')
    .bind(address, token)
    .first<Mailbox>();

  return result || null;
}

/**
 * 获取用户的邮箱列表
 */
export async function findMailboxesByUserId(
  db: D1Database,
  userId: string
): Promise<Mailbox[]> {
  const result = await db
    .prepare('SELECT * FROM mailboxes WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<Mailbox>();

  return result.results || [];
}

/**
 * 获取用户邮箱数量
 */
export async function countMailboxesByUserId(
  db: D1Database,
  userId: string
): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM mailboxes WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>();

  return result?.count || 0;
}

/**
 * 验证邮箱归属
 */
export async function verifyMailboxOwnership(
  db: D1Database,
  mailboxId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .prepare('SELECT id FROM mailboxes WHERE id = ? AND user_id = ?')
    .bind(mailboxId, userId)
    .first();

  return result !== null;
}

/**
 * 验证邮箱归属（通过地址）
 */
export async function verifyMailboxOwnershipByAddress(
  db: D1Database,
  address: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .prepare('SELECT id FROM mailboxes WHERE address = ? AND user_id = ?')
    .bind(address, userId)
    .first();

  return result !== null;
}

/**
 * 删除邮箱
 */
export async function deleteMailbox(
  db: D1Database,
  id: string
): Promise<void> {
  await db.prepare('DELETE FROM mailboxes WHERE id = ?').bind(id).run();
}

/**
 * 获取所有邮箱（管理员，分页）
 */
export async function listAllMailboxes(
  db: D1Database,
  page: number,
  pageSize: number
): Promise<PaginatedResult<MailboxWithOwner>> {
  const offset = (page - 1) * pageSize;

  const countResult = await db
    .prepare('SELECT COUNT(*) as count FROM mailboxes')
    .first<{ count: number }>();
  const total = countResult?.count || 0;

  const result = await db
    .prepare(
      `SELECT m.*, u.username as owner_username
       FROM mailboxes m
       LEFT JOIN users u ON m.user_id = u.id
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(pageSize, offset)
    .all<MailboxWithOwner>();

  return {
    items: result.results || [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取邮箱总数
 */
export async function countMailboxes(db: D1Database): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM mailboxes')
    .first<{ count: number }>();

  return result?.count || 0;
}

/**
 * 删除过期邮箱
 */
export async function deleteExpiredMailboxes(db: D1Database): Promise<number> {
  const now = new Date().toISOString();
  
  const result = await db
    .prepare(
      `DELETE FROM mailboxes 
       WHERE expires_at < ? 
       AND id NOT IN (SELECT DISTINCT mailbox_id FROM emails)`
    )
    .bind(now)
    .run();

  return result.meta.changes || 0;
}
