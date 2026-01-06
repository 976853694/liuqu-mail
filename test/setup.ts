import { env } from 'cloudflare:test';

// 初始化测试数据库 schema
export async function setupTestDatabase() {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS mailboxes (
      id TEXT PRIMARY KEY,
      address TEXT UNIQUE NOT NULL,
      token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      mailbox_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      received_at TEXT NOT NULL,
      FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
    );
  `);
}

// 清理测试数据
export async function cleanupTestDatabase() {
  await env.DB.exec('DELETE FROM emails');
  await env.DB.exec('DELETE FROM mailboxes');
}
