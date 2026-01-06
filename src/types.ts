// 用户角色
export type UserRole = 'user' | 'admin';

// 用户状态
export type UserStatus = 'active' | 'disabled';

// 环境变量
export interface Env {
  DB: D1Database;
  RETENTION_HOURS: string;
  RATE_LIMIT_PER_MINUTE: string;
  EMAIL_DOMAIN: string;
  ALLOW_REGISTRATION: string;
  MAX_MAILBOXES_PER_USER: string;
  SESSION_EXPIRY_HOURS: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
}

// 用户（完整）
export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

// 用户（不含密码）
export interface UserPublic {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

// 会话
export interface Session {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  expires_at: string;
}

// 会话验证结果
export interface SessionValidation {
  user: UserPublic;
  session: Session;
}

// 认证上下文
export interface AuthContext {
  user: UserPublic;
  session: Session;
}

// 邮箱
export interface Mailbox {
  id: string;
  address: string;
  token: string;
  user_id: string | null;
  created_at: string;
  expires_at: string;
}

// 邮箱（含所有者信息）
export interface MailboxWithOwner extends Mailbox {
  owner_username: string | null;
}

// 邮件
export interface Email {
  id: string;
  mailbox_id: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  body: string | null;
  received_at: string;
}

// 邮件摘要
export interface EmailSummary {
  id: string;
  from: string;
  subject: string | null;
  receivedAt: string;
}

// 邮件详情
export interface EmailDetail extends EmailSummary {
  to: string;
  body: string | null;
}

// 分页结果
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 系统统计
export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalMailboxes: number;
  totalEmails: number;
}

// 验证结果
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// API 响应
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// 创建邮箱响应
export interface CreateMailboxResponse {
  address: string;
  token: string;
  expiresAt: string;
}

// 用户资料响应
export interface UserProfileResponse {
  id: string;
  username: string;
  role: UserRole;
  created_at: string;
  mailboxCount: number;
}

// 登录响应
export interface LoginResponse {
  token: string;
  user: UserPublic;
  expiresAt: string;
}
