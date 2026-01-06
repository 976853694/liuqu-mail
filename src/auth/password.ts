/**
 * 密码处理模块
 * 使用 Web Crypto API 的 PBKDF2 算法（Cloudflare Workers 兼容）
 */

const ITERATIONS = 100000;
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;

/**
 * 生成随机盐值
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * 将 ArrayBuffer 或 Uint8Array 转换为 Base64 字符串
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 将 Base64 字符串转换为 Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 使用 PBKDF2 派生密钥
 */
async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH
  );

  return derivedBits;
}

/**
 * 哈希密码
 * 返回格式：salt:hash（都是 Base64 编码）
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const derivedKey = await deriveKey(password, salt);

  const saltBase64 = arrayBufferToBase64(salt);
  const hashBase64 = arrayBufferToBase64(derivedKey);

  return `${saltBase64}:${hashBase64}`;
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const [saltBase64, hashBase64] = storedHash.split(':');
    if (!saltBase64 || !hashBase64) {
      return false;
    }

    const salt = base64ToUint8Array(saltBase64);
    const storedKey = base64ToUint8Array(hashBase64);
    const derivedKey = await deriveKey(password, salt);
    const derivedKeyArray = new Uint8Array(derivedKey);

    // 时间恒定比较，防止时序攻击
    if (storedKey.length !== derivedKeyArray.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < storedKey.length; i++) {
      result |= storedKey[i] ^ derivedKeyArray[i];
    }

    return result === 0;
  } catch {
    return false;
  }
}
