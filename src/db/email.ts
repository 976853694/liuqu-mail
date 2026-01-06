import type { Email, EmailSummary, EmailDetail } from '../types';
import { generateUUID } from '../utils/random';

/**
 * 创建新邮件
 */
export async function createEmail(
  db: D1Database,
  mailboxId: string,
  fromAddress: string,
  toAddress: string,
  subject: string | null,
  body: string | null
): Promise<Email> {
  const id = generateUUID();
  const receivedAt = new Date().toISOString();

  const email: Email = {
    id,
    mailbox_id: mailboxId,
    from_address: fromAddress,
    to_address: toAddress,
    subject,
    body,
    received_at: receivedAt,
  };

  await db
    .prepare(
      `INSERT INTO emails (id, mailbox_id, from_address, to_address, subject, body, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      email.id,
      email.mailbox_id,
      email.from_address,
      email.to_address,
      email.subject,
      email.body,
      email.received_at
    )
    .run();

  return email;
}

/**
 * 获取邮箱的邮件列表（按时间倒序）
 */
export async function getEmailsByMailbox(
  db: D1Database,
  mailboxId: string
): Promise<EmailSummary[]> {
  const result = await db
    .prepare(
      `SELECT id, from_address, subject, received_at 
       FROM emails 
       WHERE mailbox_id = ? 
       ORDER BY received_at DESC`
    )
    .bind(mailboxId)
    .all<{ id: string; from_address: string; subject: string | null; received_at: string }>();

  return (result.results || []).map((row) => ({
    id: row.id,
    from: row.from_address,
    subject: row.subject,
    receivedAt: row.received_at,
  }));
}

/**
 * 根据 ID 获取邮件详情
 */
export async function getEmailById(
  db: D1Database,
  emailId: string,
  mailboxId: string
): Promise<EmailDetail | null> {
  const result = await db
    .prepare(
      `SELECT id, from_address, to_address, subject, body, received_at 
       FROM emails 
       WHERE id = ? AND mailbox_id = ?`
    )
    .bind(emailId, mailboxId)
    .first<{
      id: string;
      from_address: string;
      to_address: string;
      subject: string | null;
      body: string | null;
      received_at: string;
    }>();

  if (!result) return null;

  return {
    id: result.id,
    from: result.from_address,
    to: result.to_address,
    subject: result.subject,
    body: result.body,
    receivedAt: result.received_at,
  };
}

/**
 * 删除过期邮件
 */
export async function deleteExpiredEmails(
  db: D1Database,
  retentionHours: number
): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString();

  const result = await db
    .prepare('DELETE FROM emails WHERE received_at < ?')
    .bind(cutoffDate)
    .run();

  return result.meta.changes || 0;
}

/**
 * 获取邮件总数
 */
export async function countEmails(db: D1Database): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM emails')
    .first<{ count: number }>();

  return result?.count || 0;
}
