/**
 * 验证用户名
 * 规则：6-20位，只能包含字母、数字、下划线
 */
export function validateUsername(username: string): { valid: boolean; message?: string } {
  if (!username || username.length < 6) {
    return { valid: false, message: '用户名至少6位' };
  }
  if (username.length > 20) {
    return { valid: false, message: '用户名最多20位' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: '用户名只能包含字母、数字、下划线' };
  }
  return { valid: true };
}

/**
 * 验证密码
 * 规则：至少6位
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 6) {
    return { valid: false, message: '密码至少6位' };
  }
  return { valid: true };
}
