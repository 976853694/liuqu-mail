import { handleEmailMessage } from './email-worker';
import { handleApiRequest } from './api-worker';
import { cleanupExpiredData } from './cleanup';
import { initializeAdmin } from './init';
import type { Env } from './types';

export default {
  // HTTP 请求处理 (API)
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 确保管理员账户存在
    ctx.waitUntil(initializeAdmin(env));
    return handleApiRequest(request, env, ctx);
  },

  // 邮件接收处理
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleEmailMessage(message, env, ctx);
  },

  // 定时任务处理 (清理过期数据)
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(cleanupExpiredData(env));
  },
};
