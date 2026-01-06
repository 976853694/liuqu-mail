import type { Env, ApiResponse, CreateMailboxResponse, EmailSummary, EmailDetail, UserProfileResponse, LoginResponse, SystemStats, UserPublic, MailboxWithOwner, PaginatedResult, Mailbox } from './types';
import { createMailbox, findMailboxesByUserId, countMailboxesByUserId, verifyMailboxOwnershipByAddress, deleteMailbox, getMailboxById, listAllMailboxes, countMailboxes, getMailboxByAddress } from './db/mailbox';
import { getEmailsByMailbox, getEmailById, countEmails } from './db/email';
import { register, login, logout, getAuthConfig, invalidateUserSessions } from './auth/auth-service';
import { requireAuth, requireAdmin, isAuthContext, extractToken } from './middleware/auth';
import { findUserById, listUsers, updateUserStatus, deleteUser, countUsers, countActiveUsers, updateUserPassword, toUserPublic } from './db/user';
import { hashPassword, verifyPassword } from './auth/password';
 
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// 前端 HTML（内嵌）
let FRONTEND_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>临时邮箱</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .card { background: rgba(255,255,255,0.95); border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
    h1 { color: #333; margin-bottom: 16px; font-size: 1.8em; }
    h2 { color: #444; margin-bottom: 12px; font-size: 1.3em; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; margin-right: 8px; }
    .btn-primary { background: #667eea; color: white; }
    .btn-primary:hover { background: #5a6fd6; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-secondary:hover { background: #5a6268; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-danger:hover { background: #c82333; }
    .btn-success { background: #28a745; color: white; }
    .btn-success:hover { background: #218838; }
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    input { padding: 12px; border: 1px solid #ddd; border-radius: 6px; width: 100%; margin-bottom: 12px; font-size: 14px; }
    input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
    .hidden { display: none; }
    .email-list { list-style: none; }
    .email-item { padding: 16px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s; }
    .email-item:hover { background: #f8f9fa; }
    .mailbox-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #eee; }
    .mailbox-address { font-family: monospace; color: #667eea; cursor: pointer; font-size: 14px; }
    .mailbox-address:hover { text-decoration: underline; }
    .error { color: #dc3545; margin-bottom: 12px; padding: 10px; background: #f8d7da; border-radius: 6px; }
    .success { color: #28a745; margin-bottom: 12px; padding: 10px; background: #d4edda; border-radius: 6px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .user-badge { background: #667eea; color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; margin-right: 10px; }
    .admin-badge { background: #ffc107; color: #333; padding: 6px 12px; border-radius: 20px; font-size: 13px; margin-right: 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; }
    .stat-label { font-size: 0.9em; opacity: 0.9; }
    .table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    .table th { background: #f8f9fa; font-weight: 600; }
    .table tr:hover { background: #f8f9fa; }
    .tabs { display: flex; border-bottom: 2px solid #eee; margin-bottom: 20px; }
    .tab { padding: 12px 24px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
    .tab:hover { color: #667eea; }
    .tab.active { color: #667eea; border-bottom-color: #667eea; font-weight: 600; }
    .pagination { display: flex; justify-content: center; gap: 8px; margin-top: 20px; }
    .page-btn { padding: 8px 14px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white; }
    .page-btn:hover { background: #f8f9fa; }
    .page-btn.active { background: #667eea; color: white; border-color: #667eea; }
    pre { white-space: pre-wrap; word-wrap: break-word; background: #f8f9fa; padding: 16px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- 登录/注册区域 -->
    <div id="auth-section" class="card">
      <h1>📧 临时邮箱</h1>
      <p style="color:#666;margin-bottom:20px;">安全、私密的临时邮箱服务</p>
      <div id="login-form">
        <input type="text" id="username" placeholder="用户名" onkeypress="if(event.key==='Enter')handleLogin()">
        <input type="password" id="password" placeholder="密码" onkeypress="if(event.key==='Enter')handleLogin()">
        <div id="auth-error" class="error hidden"></div>
        <button class="btn btn-primary" onclick="handleLogin()">登录</button>
        <button class="btn btn-secondary" onclick="showRegister()">注册</button>
      </div>
      <div id="register-form" class="hidden">
        <input type="text" id="reg-username" placeholder="用户名 (3-20字符，字母数字下划线)">
        <input type="password" id="reg-password" placeholder="密码 (至少8位，含字母和数字)">
        <div id="reg-error" class="error hidden"></div>
        <button class="btn btn-primary" onclick="handleRegister()">注册</button>
        <button class="btn btn-secondary" onclick="showLogin()">返回登录</button>
      </div>
    </div>

    <!-- 用户区域 -->
    <div id="user-section" class="hidden">
      <div class="card">
        <div class="header">
          <h1>📬 我的邮箱</h1>
          <div>
            <span id="user-badge" class="user-badge"></span>
            <span id="admin-link" class="hidden"><button class="btn btn-sm btn-secondary" onclick="showAdmin()">管理后台</button></span>
            <button class="btn btn-sm btn-danger" onclick="handleLogout()">退出</button>
          </div>
        </div>
        <button class="btn btn-primary" onclick="createNewMailbox()">+ 创建新邮箱</button>
        <div id="mailbox-list" style="margin-top:16px;"></div>
      </div>
      <div id="email-section" class="card hidden">
        <div class="header">
          <h2 id="current-mailbox"></h2>
          <button class="btn btn-sm btn-secondary" onclick="refreshEmails()">刷新</button>
        </div>
        <div id="email-list"></div>
      </div>
      <div id="email-detail" class="card hidden">
        <button class="btn btn-secondary" onclick="backToList()">← 返回列表</button>
        <div id="email-content" style="margin-top:16px;"></div>
      </div>
    </div>

    <!-- 管理员区域 -->
    <div id="admin-section" class="hidden">
      <div class="card">
        <div class="header">
          <h1>⚙️ 管理后台</h1>
          <div>
            <button class="btn btn-sm btn-secondary" onclick="showUserSection()">返回用户中心</button>
            <button class="btn btn-sm btn-danger" onclick="handleLogout()">退出</button>
          </div>
        </div>
        <div id="stats-container" class="stats-grid"></div>
        <div class="tabs">
          <div class="tab active" onclick="showAdminTab('users')">用户管理</div>
          <div class="tab" onclick="showAdminTab('mailboxes')">邮箱管理</div>
        </div>
        <div id="admin-users" class="admin-tab"></div>
        <div id="admin-mailboxes" class="admin-tab hidden"></div>
      </div>
    </div>
  </div>

  <script>
    let token = localStorage.getItem('token');
    let currentUser = null;
    let currentMailbox = null;
    let adminPage = { users: 1, mailboxes: 1 };

    if (token) loadUserData();

    function showError(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.classList.remove('hidden'); }
    function hideError(id) { document.getElementById(id).classList.add('hidden'); }
    function showRegister() { document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); }
    function showLogin() { document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); }

    async function handleLogin() {
      hideError('auth-error');
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      if (!username || !password) { showError('auth-error', '请输入用户名和密码'); return; }
      try {
        const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await res.json();
        if (data.success) { token = data.data.token; localStorage.setItem('token', token); loadUserData(); }
        else { showError('auth-error', data.error.message); }
      } catch (e) { showError('auth-error', '登录失败，请重试'); }
    }

    async function handleRegister() {
      hideError('reg-error');
      const username = document.getElementById('reg-username').value;
      const password = document.getElementById('reg-password').value;
      if (!username || !password) { showError('reg-error', '请输入用户名和密码'); return; }
      try {
        const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await res.json();
        if (data.success) { alert('注册成功！请登录'); showLogin(); document.getElementById('username').value = username; }
        else { showError('reg-error', data.error.message); }
      } catch (e) { showError('reg-error', '注册失败，请重试'); }
    }

    async function handleLogout() {
      try { await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); } catch(e) {}
      token = null; currentUser = null; localStorage.removeItem('token');
      document.getElementById('auth-section').classList.remove('hidden');
      document.getElementById('user-section').classList.add('hidden');
      document.getElementById('admin-section').classList.add('hidden');
    }

    async function loadUserData() {
      try {
        const res = await fetch('/api/user/profile', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) {
          currentUser = data.data;
          document.getElementById('user-badge').textContent = currentUser.username;
          if (currentUser.role === 'admin') {
            document.getElementById('user-badge').className = 'admin-badge';
            document.getElementById('admin-link').classList.remove('hidden');
          }
          document.getElementById('auth-section').classList.add('hidden');
          document.getElementById('user-section').classList.remove('hidden');
          loadMailboxes();
        } else { handleLogout(); }
      } catch (e) { handleLogout(); }
    }

    async function loadMailboxes() {
      try {
        const res = await fetch('/api/mailboxes', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) {
          const list = document.getElementById('mailbox-list');
          if (data.data.length === 0) { list.innerHTML = '<p style="color:#666;padding:20px 0;">暂无邮箱，点击上方按钮创建一个</p>'; return; }
          list.innerHTML = data.data.map(m => '<div class="mailbox-item"><span class="mailbox-address" onclick="selectMailbox(\\'' + m.address + '\\')">' + m.address + '</span><button class="btn btn-sm btn-danger" onclick="deleteMailboxItem(\\'' + m.id + '\\')">删除</button></div>').join('');
        }
      } catch(e) { console.error(e); }
    }

    async function createNewMailbox() {
      try {
        const res = await fetch('/api/mailbox', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) { loadMailboxes(); }
        else { alert(data.error.message); }
      } catch(e) { alert('创建失败'); }
    }

    async function deleteMailboxItem(id) {
      if (!confirm('确定删除此邮箱及其所有邮件？')) return;
      try {
        await fetch('/api/mailbox/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
        loadMailboxes();
        document.getElementById('email-section').classList.add('hidden');
      } catch(e) { alert('删除失败'); }
    }

    async function selectMailbox(address) {
      currentMailbox = address;
      document.getElementById('current-mailbox').textContent = '📬 ' + address;
      document.getElementById('email-section').classList.remove('hidden');
      document.getElementById('email-detail').classList.add('hidden');
      document.getElementById('email-list').classList.remove('hidden');
      refreshEmails();
    }

    async function refreshEmails() {
      if (!currentMailbox) return;
      try {
        const res = await fetch('/api/mailbox/' + currentMailbox + '/emails', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) {
          const list = document.getElementById('email-list');
          if (data.data.length === 0) { list.innerHTML = '<p style="color:#666;padding:20px 0;">暂无邮件，等待接收中...</p>'; return; }
          list.innerHTML = '<ul class="email-list">' + data.data.map(e => '<li class="email-item" onclick="viewEmail(\\'' + e.id + '\\')"><strong>' + escapeHtml(e.subject || '(无主题)') + '</strong><br><small style="color:#666;">来自: ' + escapeHtml(e.from) + ' | ' + formatDate(e.receivedAt) + '</small></li>').join('') + '</ul>';
        }
      } catch(e) { console.error(e); }
    }

    async function viewEmail(id) {
      try {
        const res = await fetch('/api/mailbox/' + currentMailbox + '/emails/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) {
          document.getElementById('email-list').classList.add('hidden');
          document.getElementById('email-detail').classList.remove('hidden');
          const e = data.data;
          document.getElementById('email-content').innerHTML = '<h2>' + escapeHtml(e.subject || '(无主题)') + '</h2><p><strong>来自:</strong> ' + escapeHtml(e.from) + '</p><p><strong>收件:</strong> ' + escapeHtml(e.to) + '</p><p><strong>时间:</strong> ' + formatDate(e.receivedAt) + '</p><hr style="margin:16px 0;"><pre>' + escapeHtml(e.body || '(无内容)') + '</pre>';
        }
      } catch(e) { console.error(e); }
    }

    function backToList() {
      document.getElementById('email-detail').classList.add('hidden');
      document.getElementById('email-list').classList.remove('hidden');
    }

    // 管理员功能
    function showAdmin() {
      document.getElementById('user-section').classList.add('hidden');
      document.getElementById('admin-section').classList.remove('hidden');
      loadAdminStats();
      loadAdminUsers();
    }

    function showUserSection() {
      document.getElementById('admin-section').classList.add('hidden');
      document.getElementById('user-section').classList.remove('hidden');
    }

    function showAdminTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
      event.target.classList.add('active');
      document.getElementById('admin-' + tab).classList.remove('hidden');
      if (tab === 'users') loadAdminUsers();
      else loadAdminMailboxes();
    }

    async function loadAdminStats() {
      try {
        const res = await fetch('/api/admin/stats', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) {
          const s = data.data;
          document.getElementById('stats-container').innerHTML = '<div class="stat-card"><div class="stat-value">' + s.totalUsers + '</div><div class="stat-label">总用户数</div></div><div class="stat-card"><div class="stat-value">' + s.activeUsers + '</div><div class="stat-label">活跃用户</div></div><div class="stat-card"><div class="stat-value">' + s.totalMailboxes + '</div><div class="stat-label">总邮箱数</div></div><div class="stat-card"><div class="stat-value">' + s.totalEmails + '</div><div class="stat-label">总邮件数</div></div>';
        }
      } catch(e) { console.error(e); }
    }

    async function loadAdminUsers(page = 1) {
      adminPage.users = page;
      try {
        const res = await fetch('/api/admin/users?page=' + page + '&pageSize=10', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) {
          const d = data.data;
          let html = '<table class="table"><thead><tr><th>用户名</th><th>角色</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
          d.items.forEach(u => {
            const statusBtn = u.status === 'active' ? '<button class="btn btn-sm btn-secondary" onclick="toggleUserStatus(\\'' + u.id + '\\', \\'disabled\\')">禁用</button>' : '<button class="btn btn-sm btn-success" onclick="toggleUserStatus(\\'' + u.id + '\\', \\'active\\')">启用</button>';
            const deleteBtn = u.role !== 'admin' ? '<button class="btn btn-sm btn-danger" onclick="deleteUserItem(\\'' + u.id + '\\')">删除</button>' : '';
            html += '<tr><td>' + escapeHtml(u.username) + '</td><td>' + (u.role === 'admin' ? '<span class="admin-badge">管理员</span>' : '用户') + '</td><td>' + (u.status === 'active' ? '<span style="color:#28a745;">正常</span>' : '<span style="color:#dc3545;">已禁用</span>') + '</td><td>' + formatDate(u.created_at) + '</td><td>' + statusBtn + ' ' + deleteBtn + '</td></tr>';
          });
          html += '</tbody></table>';
          html += renderPagination(d, 'loadAdminUsers');
          document.getElementById('admin-users').innerHTML = html;
        }
      } catch(e) { console.error(e); }
    }

    async function loadAdminMailboxes(page = 1) {
      adminPage.mailboxes = page;
      try {
        const res = await fetch('/api/admin/mailboxes?page=' + page + '&pageSize=10', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) {
          const d = data.data;
          let html = '<table class="table"><thead><tr><th>邮箱地址</th><th>所有者</th><th>创建时间</th><th>过期时间</th><th>操作</th></tr></thead><tbody>';
          d.items.forEach(m => {
            html += '<tr><td><code>' + escapeHtml(m.address) + '</code></td><td>' + escapeHtml(m.owner_username || '无') + '</td><td>' + formatDate(m.created_at) + '</td><td>' + formatDate(m.expires_at) + '</td><td><button class="btn btn-sm btn-danger" onclick="deleteAdminMailbox(\\'' + m.id + '\\')">删除</button></td></tr>';
          });
          html += '</tbody></table>';
          html += renderPagination(d, 'loadAdminMailboxes');
          document.getElementById('admin-mailboxes').innerHTML = html;
        }
      } catch(e) { console.error(e); }
    }

    async function toggleUserStatus(userId, status) {
      if (!confirm(status === 'disabled' ? '确定禁用此用户？' : '确定启用此用户？')) return;
      try {
        await fetch('/api/admin/users/' + userId + '/status', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
        loadAdminUsers(adminPage.users);
        loadAdminStats();
      } catch(e) { alert('操作失败'); }
    }

    async function deleteUserItem(userId) {
      if (!confirm('确定删除此用户？此操作将同时删除该用户的所有邮箱和邮件！')) return;
      try {
        await fetch('/api/admin/users/' + userId, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
        loadAdminUsers(adminPage.users);
        loadAdminStats();
      } catch(e) { alert('删除失败'); }
    }

    async function deleteAdminMailbox(mailboxId) {
      if (!confirm('确定删除此邮箱？')) return;
      try {
        await fetch('/api/admin/mailboxes/' + mailboxId, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
        loadAdminMailboxes(adminPage.mailboxes);
        loadAdminStats();
      } catch(e) { alert('删除失败'); }
    }

    function renderPagination(data, fn) {
      if (data.totalPages <= 1) return '';
      let html = '<div class="pagination">';
      for (let i = 1; i <= data.totalPages; i++) {
        html += '<button class="page-btn' + (i === data.page ? ' active' : '') + '" onclick="' + fn + '(' + i + ')">' + i + '</button>';
      }
      return html + '</div>';
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatDate(str) {
      if (!str) return '';
      try { return new Date(str).toLocaleString('zh-CN'); } catch(e) { return str; }
    }
  </script>
</body>
</html>`;

export function setFrontendHtml(html: string): void {
  FRONTEND_HTML = html;
}


// 速率限制检查
function checkRateLimit(clientIP: string, limitPerMinute: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(clientIP);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIP, { count: 1, resetAt: now + 60000 });
    return { allowed: true, remaining: limitPerMinute - 1 };
  }

  if (record.count >= limitPerMinute) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: limitPerMinute - record.count };
}

// JSON 响应辅助函数
function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// CORS 响应包装
function corsResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// 主请求处理函数
export async function handleApiRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return corsResponse(new Response(null, { status: 204 }));
  }

  // 非 API 路径返回前端页面
  if (!path.startsWith('/api/')) {
    return new Response(FRONTEND_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 速率限制
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitResult = checkRateLimit(clientIP, parseInt(env.RATE_LIMIT_PER_MINUTE || '60'));
  if (!rateLimitResult.allowed) {
    return corsResponse(jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' }
    }, 429));
  }

  try {
    // 认证路由
    if (path === '/api/auth/register' && request.method === 'POST') {
      return corsResponse(await handleRegister(request, env));
    }
    if (path === '/api/auth/login' && request.method === 'POST') {
      return corsResponse(await handleLogin(request, env));
    }
    if (path === '/api/auth/logout' && request.method === 'POST') {
      return corsResponse(await handleLogout(request, env));
    }

    // 用户路由
    if (path === '/api/user/profile' && request.method === 'GET') {
      return corsResponse(await handleGetProfile(request, env));
    }
    if (path === '/api/user/password' && request.method === 'PUT') {
      return corsResponse(await handleUpdatePassword(request, env));
    }

    // 邮箱路由
    if (path === '/api/mailbox' && request.method === 'POST') {
      return corsResponse(await handleCreateMailbox(request, env));
    }
    if (path === '/api/mailboxes' && request.method === 'GET') {
      return corsResponse(await handleGetMailboxes(request, env));
    }

    // 邮箱删除 /api/mailbox/:id
    const mailboxDeleteMatch = path.match(/^\/api\/mailbox\/([^/]+)$/);
    if (mailboxDeleteMatch && request.method === 'DELETE') {
      return corsResponse(await handleDeleteMailbox(request, env, mailboxDeleteMatch[1]));
    }

    // 邮件列表 /api/mailbox/:address/emails
    const emailsMatch = path.match(/^\/api\/mailbox\/([^/]+)\/emails$/);
    if (emailsMatch && request.method === 'GET') {
      return corsResponse(await handleGetEmails(request, env, emailsMatch[1]));
    }

    // 邮件详情 /api/mailbox/:address/emails/:id
    const emailDetailMatch = path.match(/^\/api\/mailbox\/([^/]+)\/emails\/([^/]+)$/);
    if (emailDetailMatch && request.method === 'GET') {
      return corsResponse(await handleGetEmailDetail(request, env, emailDetailMatch[1], emailDetailMatch[2]));
    }

    // 管理员路由
    if (path === '/api/admin/stats' && request.method === 'GET') {
      return corsResponse(await handleAdminStats(request, env));
    }
    if (path === '/api/admin/users' && request.method === 'GET') {
      return corsResponse(await handleAdminListUsers(request, env));
    }

    // 管理员用户详情 /api/admin/users/:id
    const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (adminUserMatch) {
      if (request.method === 'GET') {
        return corsResponse(await handleAdminGetUser(request, env, adminUserMatch[1]));
      }
      if (request.method === 'DELETE') {
        return corsResponse(await handleAdminDeleteUser(request, env, adminUserMatch[1]));
      }
    }

    // 管理员更新用户状态 /api/admin/users/:id/status
    const adminUserStatusMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/status$/);
    if (adminUserStatusMatch && request.method === 'PUT') {
      return corsResponse(await handleAdminUpdateUserStatus(request, env, adminUserStatusMatch[1]));
    }

    // 管理员邮箱列表
    if (path === '/api/admin/mailboxes' && request.method === 'GET') {
      return corsResponse(await handleAdminListMailboxes(request, env));
    }

    // 管理员删除邮箱 /api/admin/mailboxes/:id
    const adminMailboxMatch = path.match(/^\/api\/admin\/mailboxes\/([^/]+)$/);
    if (adminMailboxMatch && request.method === 'DELETE') {
      return corsResponse(await handleAdminDeleteMailbox(request, env, adminMailboxMatch[1]));
    }

    // 404
    return corsResponse(jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'NOT_FOUND', message: '接口不存在' }
    }, 404));

  } catch (error) {
    console.error('API Error:', error);
    return corsResponse(jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' }
    }, 500));
  }
}


// ==================== 认证处理函数 ====================

async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { username?: string; password?: string };
  const { username, password } = body;

  if (!username || !password) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'BAD_REQUEST', message: '用户名和密码不能为空' }
    }, 400);
  }

  const config = getAuthConfig(env);
  const result = await register(env.DB, username, password, config.allowRegistration);

  if (!result.success) {
    const statusCode = result.error?.code === 'CONFLICT' ? 409 :
                       result.error?.code === 'FORBIDDEN' ? 403 : 400;
    return jsonResponse<ApiResponse>({
      success: false,
      error: result.error!
    }, statusCode);
  }

  return jsonResponse<ApiResponse<UserPublic>>({
    success: true,
    data: result.user!
  }, 201);
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { username?: string; password?: string };
  const { username, password } = body;

  if (!username || !password) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'BAD_REQUEST', message: '用户名和密码不能为空' }
    }, 400);
  }

  const config = getAuthConfig(env);
  const result = await login(env.DB, username, password, config.sessionExpiryHours);

  if (!result.success) {
    const statusCode = result.error?.code === 'FORBIDDEN' ? 403 : 401;
    return jsonResponse<ApiResponse>({
      success: false,
      error: result.error!
    }, statusCode);
  }

  return jsonResponse<ApiResponse<LoginResponse>>({
    success: true,
    data: result.data!
  });
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const token = extractToken(request);
  if (token) {
    await logout(env.DB, token);
  }
  return jsonResponse<ApiResponse>({ success: true });
}

// ==================== 用户处理函数 ====================

async function handleGetProfile(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const mailboxCount = await countMailboxesByUserId(env.DB, authResult.user.id);

  return jsonResponse<ApiResponse<UserProfileResponse>>({
    success: true,
    data: {
      id: authResult.user.id,
      username: authResult.user.username,
      role: authResult.user.role,
      created_at: authResult.user.created_at,
      mailboxCount,
    }
  });
}

async function handleUpdatePassword(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const body = await request.json() as { currentPassword?: string; newPassword?: string };
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'BAD_REQUEST', message: '当前密码和新密码不能为空' }
    }, 400);
  }

  // 获取完整用户信息（含密码哈希）
  const user = await findUserById(env.DB, authResult.user.id);
  if (!user) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'NOT_FOUND', message: '用户不存在' }
    }, 404);
  }

  // 验证当前密码
  const passwordValid = await verifyPassword(currentPassword, user.password_hash);
  if (!passwordValid) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '当前密码错误' }
    }, 401);
  }

  // 更新密码
  const newPasswordHash = await hashPassword(newPassword);
  await updateUserPassword(env.DB, authResult.user.id, newPasswordHash);

  return jsonResponse<ApiResponse>({ success: true });
}


// ==================== 邮箱处理函数 ====================

async function handleCreateMailbox(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const config = getAuthConfig(env);
  const currentCount = await countMailboxesByUserId(env.DB, authResult.user.id);

  if (currentCount >= config.maxMailboxesPerUser) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'LIMIT_EXCEEDED', message: `邮箱数量已达上限 (${config.maxMailboxesPerUser})` }
    }, 429);
  }

  const retentionHours = parseInt(env.RETENTION_HOURS || '24');
  const mailbox = await createMailbox(env.DB, env.EMAIL_DOMAIN, retentionHours, authResult.user.id);

  return jsonResponse<ApiResponse<CreateMailboxResponse>>({
    success: true,
    data: {
      address: mailbox.address,
      token: mailbox.token,
      expiresAt: mailbox.expires_at,
    }
  }, 201);
}

async function handleGetMailboxes(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const mailboxes = await findMailboxesByUserId(env.DB, authResult.user.id);

  return jsonResponse<ApiResponse<Mailbox[]>>({
    success: true,
    data: mailboxes
  });
}

async function handleDeleteMailbox(request: Request, env: Env, mailboxId: string): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const mailbox = await getMailboxById(env.DB, mailboxId);
  if (!mailbox) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'NOT_FOUND', message: '邮箱不存在' }
    }, 404);
  }

  if (mailbox.user_id !== authResult.user.id) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'FORBIDDEN', message: '无权删除此邮箱' }
    }, 403);
  }

  await deleteMailbox(env.DB, mailboxId);

  return jsonResponse<ApiResponse>({ success: true });
}

async function handleGetEmails(request: Request, env: Env, address: string): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthContext(authResult)) return authResult;

  // 验证邮箱归属
  const isOwner = await verifyMailboxOwnershipByAddress(env.DB, address, authResult.user.id);
  if (!isOwner) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'FORBIDDEN', message: '无权访问此邮箱' }
    }, 403);
  }

  const mailbox = await getMailboxByAddress(env.DB, address);
  if (!mailbox) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'NOT_FOUND', message: '邮箱不存在' }
    }, 404);
  }

  const emails = await getEmailsByMailbox(env.DB, mailbox.id);

  return jsonResponse<ApiResponse<EmailSummary[]>>({
    success: true,
    data: emails
  });
}

async function handleGetEmailDetail(request: Request, env: Env, address: string, emailId: string): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthContext(authResult)) return authResult;

  // 验证邮箱归属
  const isOwner = await verifyMailboxOwnershipByAddress(env.DB, address, authResult.user.id);
  if (!isOwner) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'FORBIDDEN', message: '无权访问此邮箱' }
    }, 403);
  }

  const mailbox = await getMailboxByAddress(env.DB, address);
  if (!mailbox) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'NOT_FOUND', message: '邮箱不存在' }
    }, 404);
  }

  const email = await getEmailById(env.DB, emailId, mailbox.id);
  if (!email) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'NOT_FOUND', message: '邮件不存在' }
    }, 404);
  }

  return jsonResponse<ApiResponse<EmailDetail>>({
    success: true,
    data: email
  });
}


// ==================== 管理员处理函数 ====================

async function handleAdminStats(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAdmin(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const [totalUsers, activeUsers, totalMailboxes, totalEmails] = await Promise.all([
    countUsers(env.DB),
    countActiveUsers(env.DB),
    countMailboxes(env.DB),
    countEmails(env.DB),
  ]);

  return jsonResponse<ApiResponse<SystemStats>>({
    success: true,
    data: { totalUsers, activeUsers, totalMailboxes, totalEmails }
  });
}

async function handleAdminListUsers(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAdmin(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

  const result = await listUsers(env.DB, page, pageSize);

  return jsonResponse<ApiResponse<PaginatedResult<UserPublic>>>({
    success: true,
    data: result
  });
}

async function handleAdminGetUser(request: Request, env: Env, userId: string): Promise<Response> {
  const authResult = await requireAdmin(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const user = await findUserById(env.DB, userId);
  if (!user) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'NOT_FOUND', message: '用户不存在' }
    }, 404);
  }

  return jsonResponse<ApiResponse<UserPublic>>({
    success: true,
    data: toUserPublic(user)
  });
}

async function handleAdminUpdateUserStatus(request: Request, env: Env, userId: string): Promise<Response> {
  const authResult = await requireAdmin(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const body = await request.json() as { status?: string };
  const { status } = body;

  if (status !== 'active' && status !== 'disabled') {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'BAD_REQUEST', message: '状态值无效，必须是 active 或 disabled' }
    }, 400);
  }

  const user = await findUserById(env.DB, userId);
  if (!user) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'NOT_FOUND', message: '用户不存在' }
    }, 404);
  }

  // 不能禁用自己
  if (userId === authResult.user.id) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'FORBIDDEN', message: '不能修改自己的状态' }
    }, 403);
  }

  await updateUserStatus(env.DB, userId, status);

  // 如果禁用用户，使其所有会话失效
  if (status === 'disabled') {
    await invalidateUserSessions(env.DB, userId);
  }

  return jsonResponse<ApiResponse>({ success: true });
}

async function handleAdminDeleteUser(request: Request, env: Env, userId: string): Promise<Response> {
  const authResult = await requireAdmin(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const user = await findUserById(env.DB, userId);
  if (!user) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'NOT_FOUND', message: '用户不存在' }
    }, 404);
  }

  // 不能删除自己
  if (userId === authResult.user.id) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'FORBIDDEN', message: '不能删除自己' }
    }, 403);
  }

  await deleteUser(env.DB, userId);

  return jsonResponse<ApiResponse>({ success: true });
}

async function handleAdminListMailboxes(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAdmin(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

  const result = await listAllMailboxes(env.DB, page, pageSize);

  return jsonResponse<ApiResponse<PaginatedResult<MailboxWithOwner>>>({
    success: true,
    data: result
  });
}

async function handleAdminDeleteMailbox(request: Request, env: Env, mailboxId: string): Promise<Response> {
  const authResult = await requireAdmin(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const mailbox = await getMailboxById(env.DB, mailboxId);
  if (!mailbox) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'NOT_FOUND', message: '邮箱不存在' }
    }, 404);
  }

  await deleteMailbox(env.DB, mailboxId);

  return jsonResponse<ApiResponse>({ success: true });
}
