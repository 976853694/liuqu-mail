export interface Env {
  DB: D1Database;
  RETENTION_HOURS: string;
  RATE_LIMIT_PER_MINUTE: string;
  EMAIL_DOMAIN: string;
}

export interface Mailbox {
  id: string;
  address: string;
  token: string;
  created_at: string;
  expires_at: string;
}

export interface Email {
  id: string;
  mailbox_id: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  body: string | null;
  received_at: string;
}

export interface EmailSummary {
  id: string;
  from: string;
  subject: string | null;
  receivedAt: string;
}

export interface EmailDetail extends EmailSummary {
  to: string;
  body: string | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface CreateMailboxResponse {
  address: string;
  token: string;
  expiresAt: string;
}
