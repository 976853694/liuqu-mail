import type { Env } from './types';
import { findUserByUsername, createUser } from './db/user';
import { hashPassword } from './auth/password';

// 用于防止重复初始化的标志
let adminInitialized = false;

/**
 * 初始化管理员账户
 * 如果不存在管理员账户，则根据环境变量创建
 */
export async function initializeAdmin(env: Env): Promise<void> {
  // 如果已经初始化过，直接返回
  if (adminInitialized) {
    return;
  }

  const adminUsername = env.ADMIN_USERNAME;
  const adminPassword = env.ADMIN_PASSWORD;

  // 如果没有配置管理员账户，跳过初始化
  if (!adminUsername || !adminPassword) {
    adminInitialized = true;
    return;
  }

  try {
    // 检查管理员是否已存在
    const existingAdmin = await findUserByUsername(env.DB, adminUsername);
    if (existingAdmin) {
      adminInitialized = true;
      return;
    }

    // 创建管理员账户
    const passwordHash = await hashPassword(adminPassword);
    await createUser(env.DB, {
      username: adminUsername,
      passwordHash,
      role: 'admin',
    });

    console.log(`Admin user "${adminUsername}" created successfully`);
    adminInitialized = true;
  } catch (error) {
    // 如果是并发创建导致的冲突，忽略错误
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      adminInitialized = true;
      return;
    }
    console.error('Failed to initialize admin:', error);
  }
}
