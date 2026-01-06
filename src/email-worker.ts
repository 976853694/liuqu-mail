import PostalMime from 'postal-mime';
import type { Env } from './types';
import { getMailboxByAddress } from './db/mailbox';
import { createEmail } from './db/email';

/**
 * 处理入站邮件
 */
export async function handleEmailMessage(
  message: EmailMessage,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  try {
    const toAddress = message.to;
    
    // 检查邮箱是否存在
    const mailbox = await getMailboxByAddress(env.DB, toAddress);
    if (!mailbox) {
      // 邮箱不存在，静默丢弃
      console.log(`Mailbox not found: ${toAddress}, discarding email`);
      return;
    }

    // 检查邮箱是否过期
    if (new Date(mailbox.expires_at) < new Date()) {
      console.log(`Mailbox expired: ${toAddress}, discarding email`);
      return;
    }

    // 解析邮件内容
    const rawEmail = new Response(message.raw);
    const parser = new PostalMime();
    const parsed = await parser.parse(await rawEmail.arrayBuffer());

    // 提取纯文本内容（忽略附件）
    const body = parsed.text || parsed.html || null;
    const subject = parsed.subject || null;
    const fromAddress = parsed.from?.address || message.from;

    // 存储邮件
    await createEmail(
      env.DB,
      mailbox.id,
      fromAddress,
      toAddress,
      subject,
      body
    );

    console.log(`Email stored for mailbox: ${toAddress}`);
  } catch (error) {
    console.error('Error processing email:', error);
    // 不抛出错误，避免邮件重试
  }
}
