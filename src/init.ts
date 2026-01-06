import type { Env } from './types';
import { findUserByUsername, createUser } from './db/user';
import { hashPassword } from './auth/password';

/**
 * 检查数据库表是否存在
 */
async function checkTablesExist(db: D1Database): Promise<boolean> {
  try {
    const result = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).first();
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * 初始化数据库表结构
 */
async function initializeDatabase(db: D1Database): Promise<void> {
  console.log('Starting database initialization...');
  
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
  console.log('Users table created');

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
  console.log('Sessions table created');

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
  console.log('Mailboxes table created');

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
  console.log('Emails table created');

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
    } catch (e) {
      console.log('Index creation skipped:', sql);
    }
  }
  console.log('Database initialization completed');
}

/**
 * 初始化管理员账户
 */
async function initializeAdminUser(env: Env): Promise<void> {
  const adminUsername = env.ADMIN_USERNAME;
  const adminPassword = env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.log('Admin credentials not configured, skipping admin creation');
    return;
  }

  try {
    const existingAdmin = await findUserByUsername(env.DB, adminUsername);
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    const passwordHash = await hashPassword(adminPassword);
    await createUser(env.DB, {
      username: adminUsername,
      passwordHash,
      role: 'admin',
    });
    console.log(`Admin user "${adminUsername}" created successfully`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      console.log('Admin user already exists (concurrent creation)');
      return;
    }
    console.error('Failed to initialize admin:', error);
    throw error;
  }
}

/**
 * 初始化系统（数据库 + 管理员）
 */
export async function initializeAdmin(env: Env): Promise<void> {
  try {
    // 检查表是否已存在
    const tablesExist = await checkTablesExist(env.DB);
    
    if (!tablesExist) {
      console.log('Tables do not exist, initializing database...');
      await initializeDatabase(env.DB);
    } else {
      console.log('Tables already exist, skipping database initialization');
    }
    
    // 始终尝试创建管理员（如果不存在）
    await initializeAdminUser(env);
  } catch (error) {
    console.error('Initialization error:', error);
    throw error; // 重新抛出错误，让调用者知道初始化失败
  }
}
