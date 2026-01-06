import type { ValidationResult } from '../types';

/**
 * 验证用户名格式
 * 规则：3-20字符，只允许字母、数字和下划线
 */
export function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];

  if (!username) {
    errors.push('用户名不能为空');
    return { valid: false, errors };
  }

  if (username.length < 3) {
    errors.push('用户名至少需要3个字符');
  }

  if (username.length > 20) {
    errors.push('用户名不能超过20个字符');
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('用户名只能包含字母、数字和下划线');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证密码强度
 * 规则：至少8字符，包含至少一个字母和一个数字
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (!password) {
    errors.push('密码不能为空');
    return { valid: false, errors };
  }

  if (password.length < 8) {
    errors.push('密码至少需要8个字符');
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push('密码必须包含至少一个字母');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含至少一个数字');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证注册输入
 */
export function validateRegistration(
  username: string,
  password: string
): ValidationResult {
  const usernameResult = validateUsername(username);
  const passwordResult = validatePassword(password);

  return {
    valid: usernameResult.valid && passwordResult.valid,
    errors: [...usernameResult.errors, ...passwordResult.errors],
  };
}
