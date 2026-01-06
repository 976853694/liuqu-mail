const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * 生成指定长度的随机字母数字字符串
 */
export function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((byte) => ALPHANUMERIC[byte % ALPHANUMERIC.length])
    .join('');
}

/**
 * 生成随机邮箱地址
 * 格式: {8-12位随机字符}@{domain}
 */
export function generateEmailAddress(domain: string): string {
  // 随机选择 8-12 之间的长度
  const length = 8 + Math.floor(Math.random() * 5);
  const localPart = generateRandomString(length);
  return `${localPart}@${domain}`;
}

/**
 * 生成唯一访问令牌
 */
export function generateToken(): string {
  return generateRandomString(32);
}

/**
 * 生成 UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}
