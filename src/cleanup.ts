import type { Env } from './types';
import { deleteExpiredEmails } from './db/email';
import { deleteExpiredMailboxes } from './db/mailbox';
import { deleteExpiredSessions } from './db/session';

/**
 * 清理过期数据
 * 由 Cron Trigger 定时调用
 */
export async function cleanupExpiredData(env: Env): Promise<{ emails: number; mailboxes: number; sessions: number }> {
  const retentionHours = parseInt(env.RETENTION_HOURS || '24');

  console.log(`Starting cleanup with retention period: ${retentionHours} hours`);

  // 删除过期会话
  const deletedSessions = await deleteExpiredSessions(env.DB);
  console.log(`Deleted ${deletedSessions} expired sessions`);

  // 删除过期邮件
  const deletedEmails = await deleteExpiredEmails(env.DB, retentionHours);
  console.log(`Deleted ${deletedEmails} expired emails`);

  // 删除空的过期邮箱
  const deletedMailboxes = await deleteExpiredMailboxes(env.DB);
  console.log(`Deleted ${deletedMailboxes} expired mailboxes`);

  return {
    emails: deletedEmails,
    mailboxes: deletedMailboxes,
    sessions: deletedSessions,
  };
}
