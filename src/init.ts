import type { Env } from './types';
import { findUserByUsername, createUser } from './db/user';
import { hashPassword } from './auth/password';

/**
 * 初始化数据库表结构
 */
async function initializeDatabase(db: D1Database): Promise<void> {
  // 创建用户表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    )
  `);

  // 创建会话表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 创建邮箱表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mailboxes (
      id TEXT PRIMARY KEY,
      address TEXT UNIQUE NOT NULL,
      token TEXT NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  // 创建邮件表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      received_at TEXT NOT NULL,
      FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)',
    'CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address)',
    'CREATE INDEX IF NOT EXISTS idx_mailboxes_user_id ON mailboxes(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id)',
  ];

  for (const sql of indexes) {
    try {
      await db.exec(sql);
    } catch {
      // 忽略索引创建错误
    }
  }
}

/**
 * 初始化管理员账户
 */
async function initializeAdminUser(env: Env): Promise<void> {
  const adminUsername = env.ADMIN_USERNAME;
  const adminPassword = env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return;
  }

  try {
    const existingAdmin = await findUserByUsername(env.DB, adminUsername);
    if (existingAdmin) {
      return;
    }

    const passwordHash = await hashPassword(adminPassword);
    await createUser(env.DB, {
      username: adminUsername,
      passwordHash,
      role: 'admin',
    });
  } catch (error) {
    // 忽略并发创建导致的冲突
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return;
    }
    console.error('Failed to initialize admin:', error);
  }
}

/**
 * 初始化系统（数据库 + 管理员）
 */
export async function initializeAdmin(env: Env): Promise<void> {
  try {
    await initializeDatabase(env.DB);
    await initializeAdminUser(env);
  } catch (error) {
    console.error('Initialization error:', error);
    // 不抛出错误，让应用继续运行
  }
}
