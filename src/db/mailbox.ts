import type { Mailbox, Env } from '../types';
import { generateUUID, generateEmailAddress, generateToken } from '../utils/random';

/**
 * 创建新邮箱
 */
export async function createMailbox(
  db: D1Database,
  domain: string,
  retentionHours: number
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
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  await db
    .prepare(
      `INSERT INTO mailboxes (id, address, token, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(mailbox.id, mailbox.address, mailbox.token, mailbox.created_at, mailbox.expires_at)
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
 * 验证邮箱访问权限
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
 * 删除过期邮箱
 */
export async function deleteExpiredMailboxes(db: D1Database): Promise<number> {
  const now = new Date().toISOString();
  
  // 删除没有邮件且已过期的邮箱
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
