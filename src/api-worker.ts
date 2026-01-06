import type { Env, ApiResponse, CreateMailboxResponse, EmailSummary, EmailDetail, UserProfileResponse, LoginResponse, SystemStats, UserPublic, MailboxWithOwner, PaginatedResult, Mailbox } from './types';
import { createMailbox, findMailboxesByUserId, countMailboxesByUserId, verifyMailboxOwnershipByAddress, deleteMailbox, getMailboxById, listAllMailboxes, countMailboxes, getMailboxByAddress } from './db/mailbox';
import { getEmailsByMailbox, getEmailById, countEmails } from './db/email';
import { register, login, logout, getAuthConfig, invalidateUserSessions } from './auth/auth-service';
import { requireAuth, requireAdmin, isAuthContext, extractToken } from './middleware/auth';
import { findUserById, listUsers, updateUserStatus, deleteUser, countUsers, countActiveUsers, updateUserPassword, updateUsername, toUserPublic, findUserByUsername, createUser, hasAdminUser } from './db/user';
import { hashPassword, verifyPassword } from './auth/password';
 
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// 前端 HTML（内嵌）- 侧边栏布局
let FRONTEND_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>临时邮箱 - 安全私密的临时邮件服务</title>
  <style>
    :root {
      --primary: #2563EB;
      --primary-hover: #1D4ED8;
      --secondary: #3B82F6;
      --cta: #F97316;
      --cta-hover: #EA580C;
      --bg: #F8FAFC;
      --text: #1E293B;
      --text-muted: #64748B;
      --border: #E2E8F0;
      --success: #10B981;
      --danger: #EF4444;
      --warning: #F59E0B;
      --card-bg: rgba(255,255,255,0.85);
      --sidebar-width: 240px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; 
      background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 50%, #0EA5E9 100%);
      background-attachment: fixed;
      min-height: 100vh;
      color: var(--text);
      line-height: 1.6;
    }
    
    /* Auth Container - 登录页面居中 */
    .auth-container { 
      max-width: 420px; 
      margin: 0 auto; 
      padding: 60px 16px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .auth-container.hidden { display: none !important; }
    
    /* App Layout - 侧边栏布局 */
    .app-layout {
      display: flex;
      min-height: 100vh;
    }
    
    /* Sidebar */
    .sidebar {
      width: var(--sidebar-width);
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      z-index: 100;
    }
    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid var(--border);
    }
    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sidebar-logo-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sidebar-logo-icon svg { width: 20px; height: 20px; color: white; }
    .sidebar-logo-text { font-weight: 700; font-size: 16px; color: var(--text); }
    
    .sidebar-user {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sidebar-avatar {
      width: 36px;
      height: 36px;
      background: var(--primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 14px;
    }
    .sidebar-username { font-weight: 500; font-size: 14px; }
    .sidebar-role { font-size: 12px; color: var(--text-muted); }
    
    .sidebar-nav {
      flex: 1;
      padding: 12px 0;
      overflow-y: auto;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s ease-out;
      font-size: 14px;
      font-weight: 500;
    }
    .nav-item:hover { background: rgba(37,99,235,0.05); color: var(--text); }
    .nav-item.active { background: rgba(37,99,235,0.1); color: var(--primary); }
    .nav-item svg { width: 20px; height: 20px; }
    .nav-divider { height: 1px; background: var(--border); margin: 8px 20px; }
    
    .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border);
    }
    .nav-item.logout { color: var(--danger); }
    .nav-item.logout:hover { background: rgba(239,68,68,0.05); }
    
    /* Main Content */
    .main-content {
      flex: 1;
      margin-left: var(--sidebar-width);
      display: flex;
      flex-direction: column;
    }
    
    /* Page Container */
    .page-container {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }
    
    /* Two Column Layout for Mailbox */
    .mailbox-layout {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 20px;
      height: calc(100vh - 48px);
    }
    
    .mailbox-panel, .email-panel {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      border: 1px solid rgba(255,255,255,0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .panel-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255,255,255,0.5);
    }
    .panel-title { font-weight: 600; font-size: 15px; }
    .panel-body { flex: 1; overflow-y: auto; }
    
    .container { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
    .card { 
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 16px; 
      padding: 28px; 
      margin-bottom: 20px; 
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      border: 1px solid rgba(255,255,255,0.3);
    }
    h1 { color: var(--text); margin-bottom: 8px; font-size: 1.75em; font-weight: 700; }
    h2 { color: var(--text); margin-bottom: 16px; font-size: 1.25em; font-weight: 600; }
    .subtitle { color: var(--text-muted); margin-bottom: 24px; font-size: 0.95em; }
    
    /* Buttons */
    .btn { 
      padding: 12px 24px; 
      border: none; 
      border-radius: 8px; 
      cursor: pointer; 
      font-size: 14px; 
      font-weight: 500;
      transition: all 0.2s ease-out; 
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-cta { background: var(--cta); color: white; }
    .btn-cta:hover { background: var(--cta-hover); }
    .btn-secondary { background: var(--bg); color: var(--text); border: 1px solid var(--border); }
    .btn-secondary:hover { background: #F1F5F9; }
    .btn-danger { background: var(--danger); color: white; }
    .btn-danger:hover { background: #DC2626; }
    .btn-success { background: var(--success); color: white; }
    .btn-success:hover { background: #059669; }
    .btn-sm { padding: 8px 14px; font-size: 13px; }
    .btn-ghost { background: transparent; color: var(--primary); }
    .btn-ghost:hover { background: rgba(37,99,235,0.1); }
    .btn-icon { padding: 8px; border-radius: 8px; }
    
    /* Inputs */
    input { 
      padding: 14px 16px; 
      border: 1px solid var(--border); 
      border-radius: 8px; 
      width: 100%; 
      margin-bottom: 14px; 
      font-size: 15px;
      background: white;
      transition: all 0.2s ease-out;
    }
    input:focus { 
      outline: none; 
      border-color: var(--primary); 
      box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
    }
    input::placeholder { color: #94A3B8; }
    
    .hidden { display: none !important; }
    
    /* Email List */
    .email-list { list-style: none; }
    .email-item { 
      padding: 14px 20px; 
      border-bottom: 1px solid var(--border); 
      cursor: pointer; 
      transition: all 0.15s ease-out;
    }
    .email-item:hover { background: rgba(37,99,235,0.05); }
    .email-item.active { background: rgba(37,99,235,0.1); }
    .email-subject { font-weight: 600; color: var(--text); margin-bottom: 4px; font-size: 14px; }
    .email-meta { font-size: 12px; color: var(--text-muted); }
    
    /* Mailbox List in Panel */
    .mailbox-list-item { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      padding: 12px 20px; 
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.15s ease-out;
    }
    .mailbox-list-item:hover { background: rgba(37,99,235,0.05); }
    .mailbox-list-item.active { background: rgba(37,99,235,0.1); }
    .mailbox-address { 
      font-family: 'SF Mono', Monaco, 'Courier New', monospace; 
      color: var(--primary); 
      font-size: 13px;
      font-weight: 500;
    }
    
    /* Old Mailbox Item for Admin */
    .mailbox-item { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      padding: 16px 18px; 
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 10px;
      background: white;
      transition: all 0.15s ease-out;
    }
    .mailbox-item:hover { border-color: var(--primary); box-shadow: 0 2px 8px rgba(37,99,235,0.1); }
    
    /* Alerts */
    .error { 
      color: #991B1B; 
      margin-bottom: 14px; 
      padding: 12px 16px; 
      background: #FEF2F2; 
      border-radius: 8px;
      border: 1px solid #FECACA;
      font-size: 14px;
    }
    .success { 
      color: #065F46; 
      margin-bottom: 14px; 
      padding: 12px 16px; 
      background: #ECFDF5; 
      border-radius: 8px;
      border: 1px solid #A7F3D0;
      font-size: 14px;
    }
    
    /* Header */
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    
    /* Badges */
    .badge { 
      padding: 6px 14px; 
      border-radius: 20px; 
      font-size: 13px;
      font-weight: 500;
    }
    .user-badge { background: var(--primary); color: white; }
    .admin-badge { background: var(--warning); color: #78350F; }
    
    /* Stats Grid */
    .stats-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); 
      gap: 16px; 
      margin-bottom: 24px; 
    }
    .stat-card { 
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); 
      color: white; 
      padding: 20px; 
      border-radius: 12px; 
      text-align: center;
    }
    .stat-value { font-size: 2em; font-weight: 700; }
    .stat-label { font-size: 0.85em; opacity: 0.9; margin-top: 4px; }
    
    /* Table */
    .table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .table th, .table td { padding: 14px 12px; text-align: left; border-bottom: 1px solid var(--border); }
    .table th { background: var(--bg); font-weight: 600; font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .table tr:hover { background: #F8FAFC; }
    .table code { background: #F1F5F9; padding: 4px 8px; border-radius: 4px; font-size: 13px; }
    
    /* Tabs */
    .tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 24px; gap: 4px; }
    .tab { 
      padding: 14px 24px; 
      cursor: pointer; 
      border-bottom: 2px solid transparent; 
      margin-bottom: -2px; 
      transition: all 0.2s ease-out;
      font-weight: 500;
      color: var(--text-muted);
      border-radius: 8px 8px 0 0;
    }
    .tab:hover { color: var(--primary); background: rgba(37,99,235,0.05); }
    .tab.active { color: var(--primary); border-bottom-color: var(--primary); background: rgba(37,99,235,0.05); }
    
    /* Pagination */
    .pagination { display: flex; justify-content: center; gap: 6px; margin-top: 24px; }
    .page-btn { 
      padding: 10px 16px; 
      border: 1px solid var(--border); 
      border-radius: 8px; 
      cursor: pointer; 
      background: white;
      font-weight: 500;
      transition: all 0.15s ease-out;
    }
    .page-btn:hover { background: var(--bg); border-color: var(--primary); }
    .page-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
    
    /* Pre */
    pre { 
      white-space: pre-wrap; 
      word-wrap: break-word; 
      background: var(--bg); 
      padding: 20px; 
      border-radius: 10px;
      font-size: 14px;
      line-height: 1.7;
      border: 1px solid var(--border);
    }
    
    /* Logo */
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-icon { 
      width: 48px; 
      height: 48px; 
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    
    /* Divider */
    .divider { border: none; border-top: 1px solid var(--border); margin: 28px 0; }
    
    /* Empty State */
    .empty-state { 
      text-align: center; 
      padding: 40px 20px; 
      color: var(--text-muted);
    }
    .empty-state-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
    
    /* Status */
    .status-active { color: var(--success); }
    .status-disabled { color: var(--danger); }
    
    /* Responsive */
    @media (max-width: 768px) {
      .sidebar { 
        transform: translateX(-100%);
        transition: transform 0.3s ease-out;
      }
      .sidebar.open { transform: translateX(0); }
      .main-content { margin-left: 0; }
      .mailbox-layout { 
        grid-template-columns: 1fr;
        height: auto;
      }
      .mobile-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: rgba(255,255,255,0.95);
        backdrop-filter: blur(12px);
        position: sticky;
        top: 0;
        z-index: 50;
      }
      .menu-btn { display: block; }
    }
    @media (min-width: 769px) {
      .mobile-header { display: none; }
      .menu-btn { display: none; }
    }
    @media (max-width: 640px) {
      .container { padding: 16px 12px; }
      .card { padding: 20px 16px; }
      .header { flex-direction: column; align-items: flex-start; }
      .header-actions { width: 100%; justify-content: flex-start; }
      .btn { padding: 10px 16px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .table { font-size: 13px; }
      .table th, .table td { padding: 10px 8px; }
    }
    
    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      * { transition: none !important; }
    }
  </style>
</head>
<body>
  <!-- 登录页面 -->
  <div id="auth-section" class="auth-container">
    <div class="card">
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <div>
          <h1>临时邮箱</h1>
          <p class="subtitle" style="margin-bottom:0;">安全、私密的临时邮件服务</p>
        </div>
      </div>
      <hr class="divider">
      <div id="login-form">
        <input type="text" id="username" placeholder="用户名 (至少6位)" onkeypress="if(event.key==='Enter')handleLogin()" autocomplete="username">
        <input type="password" id="password" placeholder="密码 (至少6位)" onkeypress="if(event.key==='Enter')handleLogin()" autocomplete="current-password">
        <div id="auth-error" class="error hidden" role="alert"></div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-primary" onclick="handleLogin()">登录</button>
          <button class="btn btn-secondary" onclick="showRegister()">注册账号</button>
        </div>
      </div>
      <div id="register-form" class="hidden">
        <input type="text" id="reg-username" placeholder="用户名 (至少6位)" autocomplete="username">
        <input type="password" id="reg-password" placeholder="密码 (至少6位)" autocomplete="new-password">
        <div id="reg-error" class="error hidden" role="alert"></div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-cta" onclick="handleRegister()">立即注册</button>
          <button class="btn btn-ghost" onclick="showLogin()">返回登录</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 主应用布局 -->
  <div id="app-section" class="app-layout hidden">
    <!-- 侧边栏 -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <span class="sidebar-logo-text">临时邮箱</span>
        </div>
      </div>
      <div class="sidebar-user">
        <div class="sidebar-avatar" id="user-avatar">U</div>
        <div>
          <div class="sidebar-username" id="sidebar-username">用户名</div>
          <div class="sidebar-role" id="sidebar-role">普通用户</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-item active" id="nav-mailbox" onclick="showPage('mailbox')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span>我的邮箱</span>
        </div>
        <div class="nav-item" id="nav-settings" onclick="showPage('settings')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>账户设置</span>
        </div>
        <div class="nav-divider"></div>
        <div class="nav-item hidden" id="nav-admin" onclick="showPage('admin')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>管理后台</span>
        </div>
      </nav>
      <div class="sidebar-footer">
        <div class="nav-item logout" onclick="handleLogout()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>退出登录</span>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 移动端顶部栏 -->
      <div class="mobile-header">
        <button class="btn btn-icon menu-btn" onclick="toggleSidebar()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <span class="sidebar-logo-text">临时邮箱</span>
        <div style="width:40px;"></div>
      </div>

      <!-- 邮箱页面 -->
      <div id="page-mailbox" class="page-container">
        <div class="mailbox-layout">
          <!-- 邮箱列表面板 -->
          <div class="mailbox-panel">
            <div class="panel-header">
              <span class="panel-title">邮箱列表</span>
              <button class="btn btn-sm btn-cta" onclick="createNewMailbox()">+ 新建</button>
            </div>
            <div class="panel-body" id="mailbox-list"></div>
          </div>
          <!-- 邮件面板 -->
          <div class="email-panel">
            <div class="panel-header">
              <span class="panel-title" id="current-mailbox">选择一个邮箱</span>
              <button class="btn btn-sm btn-secondary" onclick="refreshEmails()">刷新</button>
            </div>
            <div class="panel-body">
              <div id="email-list">
                <div class="empty-state">
                  <div class="empty-state-icon">📬</div>
                  <p>选择左侧邮箱查看邮件</p>
                </div>
              </div>
              <div id="email-detail" class="hidden" style="padding:20px;">
                <button class="btn btn-ghost btn-sm" onclick="backToList()">← 返回列表</button>
                <div id="email-content" style="margin-top:16px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 设置页面 -->
      <div id="page-settings" class="page-container hidden">
        <div class="container">
          <div class="card">
            <h1 style="margin-bottom:24px;">账户设置</h1>
            
            <!-- 修改用户名 -->
            <div style="margin-bottom:28px;">
              <h2>修改用户名</h2>
              <p style="color:var(--text-muted);margin-bottom:16px;">当前用户名: <strong id="current-username"></strong></p>
              <input type="text" id="new-username" placeholder="新用户名 (至少6位)">
              <div id="username-error" class="error hidden" role="alert"></div>
              <div id="username-success" class="success hidden" role="status"></div>
              <button class="btn btn-primary" onclick="handleUpdateUsername()">修改用户名</button>
            </div>
            
            <hr class="divider">
            
            <!-- 修改密码 -->
            <div>
              <h2>修改密码</h2>
              <input type="password" id="current-password" placeholder="当前密码" autocomplete="current-password">
              <input type="password" id="new-password" placeholder="新密码 (至少6位)" autocomplete="new-password">
              <input type="password" id="confirm-password" placeholder="确认新密码" autocomplete="new-password">
              <div id="password-error" class="error hidden" role="alert"></div>
              <div id="password-success" class="success hidden" role="status"></div>
              <button class="btn btn-primary" onclick="handleUpdatePassword()">修改密码</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 管理后台页面 -->
      <div id="page-admin" class="page-container hidden">
        <div class="container">
          <div class="card">
            <h1 style="margin-bottom:24px;">管理后台</h1>
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
    </main>
  </div>

  <script>
    let token = localStorage.getItem('token');
    let currentUser = null;
    let currentMailbox = null;
    let currentMailboxId = null;
    let adminPage = { users: 1, mailboxes: 1 };

    if (token) loadUserData();

    // 页面切换
    function showPage(page) {
      document.querySelectorAll('.page-container').forEach(p => p.classList.add('hidden'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('page-' + page).classList.remove('hidden');
      document.getElementById('nav-' + page).classList.add('active');
      if (page === 'settings') {
        document.getElementById('current-username').textContent = currentUser.username;
        document.getElementById('new-username').value = '';
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        hideError('username-error'); hideError('password-error');
        document.getElementById('username-success').classList.add('hidden');
        document.getElementById('password-success').classList.add('hidden');
      }
      if (page === 'admin') {
        loadAdminStats();
        loadAdminUsers();
      }
      // 移动端关闭侧边栏
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
      }
    }

    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
    }

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
      token = null; currentUser = null; currentMailbox = null; currentMailboxId = null;
      localStorage.removeItem('token');
      document.getElementById('auth-section').classList.remove('hidden');
      document.getElementById('app-section').classList.add('hidden');
    }

    async function loadUserData() {
      try {
        const res = await fetch('/api/user/profile', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) {
          currentUser = data.data;
          // 更新侧边栏用户信息
          document.getElementById('sidebar-username').textContent = currentUser.username;
          document.getElementById('user-avatar').textContent = currentUser.username.charAt(0).toUpperCase();
          if (currentUser.role === 'admin') {
            document.getElementById('sidebar-role').textContent = '管理员';
            document.getElementById('nav-admin').classList.remove('hidden');
          } else {
            document.getElementById('sidebar-role').textContent = '普通用户';
            document.getElementById('nav-admin').classList.add('hidden');
          }
          document.getElementById('auth-section').classList.add('hidden');
          document.getElementById('app-section').classList.remove('hidden');
          showPage('mailbox');
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
          if (data.data.length === 0) { 
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>暂无邮箱，点击上方按钮创建</p></div>'; 
            return; 
          }
          list.innerHTML = data.data.map(m => {
            const isActive = currentMailbox === m.address ? ' active' : '';
            return '<div class="mailbox-list-item' + isActive + '" onclick="selectMailbox(\\'' + m.address + '\\', \\'' + m.id + '\\', event)"><span class="mailbox-address">' + m.address + '</span><button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteMailboxItem(\\'' + m.id + '\\')">删除</button></div>';
          }).join('');
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
        if (currentMailboxId === id) {
          currentMailbox = null;
          currentMailboxId = null;
          document.getElementById('current-mailbox').textContent = '选择一个邮箱';
          document.getElementById('email-list').innerHTML = '<div class="empty-state"><div class="empty-state-icon">📬</div><p>选择左侧邮箱查看邮件</p></div>';
        }
        loadMailboxes();
      } catch(e) { alert('删除失败'); }
    }

    async function selectMailbox(address, id, evt) {
      currentMailbox = address;
      currentMailboxId = id;
      document.getElementById('current-mailbox').textContent = address;
      document.getElementById('email-detail').classList.add('hidden');
      document.getElementById('email-list').classList.remove('hidden');
      // 更新选中状态
      document.querySelectorAll('.mailbox-list-item').forEach(item => item.classList.remove('active'));
      if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
      refreshEmails();
    }

    async function refreshEmails() {
      if (!currentMailbox) return;
      try {
        const res = await fetch('/api/mailbox/' + currentMailbox + '/emails', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        if (data.success) {
          const list = document.getElementById('email-list');
          if (data.data.length === 0) { 
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>暂无邮件，等待接收中...</p></div>'; 
            return; 
          }
          list.innerHTML = '<ul class="email-list">' + data.data.map(e => '<li class="email-item" onclick="viewEmail(\\'' + e.id + '\\')"><div class="email-subject">' + escapeHtml(e.subject || '(无主题)') + '</div><div class="email-meta">来自: ' + escapeHtml(e.from) + ' · ' + formatDate(e.receivedAt) + '</div></li>').join('') + '</ul>';
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
          document.getElementById('email-content').innerHTML = '<h2 style="margin-bottom:16px;">' + escapeHtml(e.subject || '(无主题)') + '</h2><p style="color:var(--text-muted);margin-bottom:8px;"><strong>来自:</strong> ' + escapeHtml(e.from) + '</p><p style="color:var(--text-muted);margin-bottom:8px;"><strong>收件:</strong> ' + escapeHtml(e.to) + '</p><p style="color:var(--text-muted);margin-bottom:20px;"><strong>时间:</strong> ' + formatDate(e.receivedAt) + '</p><hr class="divider"><pre>' + escapeHtml(e.body || '(无内容)') + '</pre>';
        }
      } catch(e) { console.error(e); }
    }

    function backToList() {
      document.getElementById('email-detail').classList.add('hidden');
      document.getElementById('email-list').classList.remove('hidden');
    }

    // 管理员功能
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
            html += '<tr><td>' + escapeHtml(u.username) + '</td><td>' + (u.role === 'admin' ? '<span class="badge admin-badge">管理员</span>' : '<span style="color:var(--text-muted);">用户</span>') + '</td><td>' + (u.status === 'active' ? '<span class="status-active">● 正常</span>' : '<span class="status-disabled">● 已禁用</span>') + '</td><td>' + formatDate(u.created_at) + '</td><td style="white-space:nowrap;">' + statusBtn + ' ' + deleteBtn + '</td></tr>';
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
            html += '<tr><td><code>' + escapeHtml(m.address) + '</code></td><td>' + escapeHtml(m.owner_username || '-') + '</td><td>' + formatDate(m.created_at) + '</td><td>' + formatDate(m.expires_at) + '</td><td><button class="btn btn-sm btn-danger" onclick="deleteAdminMailbox(\\'' + m.id + '\\')">删除</button></td></tr>';
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

    // 设置功能
    function showSuccess(id, msg) {
      const el = document.getElementById(id);
      el.textContent = msg;
      el.classList.remove('hidden');
    }

    async function handleUpdateUsername() {
      hideError('username-error');
      document.getElementById('username-success').classList.add('hidden');
      const newUsername = document.getElementById('new-username').value.trim();
      if (!newUsername) { showError('username-error', '请输入新用户名'); return; }
      if (newUsername.length < 6) { showError('username-error', '用户名至少6位'); return; }
      try {
        const res = await fetch('/api/user/username', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ newUsername }) });
        const data = await res.json();
        if (data.success) {
          showSuccess('username-success', '用户名修改成功！');
          currentUser.username = newUsername;
          document.getElementById('sidebar-username').textContent = newUsername;
          document.getElementById('user-avatar').textContent = newUsername.charAt(0).toUpperCase();
          document.getElementById('current-username').textContent = newUsername;
          document.getElementById('new-username').value = '';
        } else { showError('username-error', data.error.message); }
      } catch(e) { showError('username-error', '修改失败，请重试'); }
    }

    async function handleUpdatePassword() {
      hideError('password-error');
      document.getElementById('password-success').classList.add('hidden');
      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      if (!currentPassword) { showError('password-error', '请输入当前密码'); return; }
      if (!newPassword) { showError('password-error', '请输入新密码'); return; }
      if (newPassword.length < 6) { showError('password-error', '新密码至少6位'); return; }
      if (newPassword !== confirmPassword) { showError('password-error', '两次输入的新密码不一致'); return; }
      try {
        const res = await fetch('/api/user/password', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
        const data = await res.json();
        if (data.success) {
          showSuccess('password-success', '密码修改成功！');
          document.getElementById('current-password').value = '';
          document.getElementById('new-password').value = '';
          document.getElementById('confirm-password').value = '';
        } else { showError('password-error', data.error.message); }
      } catch(e) { showError('password-error', '修改失败，请重试'); }
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
    if (path === '/api/user/username' && request.method === 'PUT') {
      return corsResponse(await handleUpdateUsername(request, env));
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

    // 调试接口 - 检查环境变量和手动创建管理员
    if (path === '/api/debug/init') {
      return corsResponse(await handleDebugInit(env));
    }

    // 调试接口 - 直接设置管理员账户（用于首次部署）
    if (path === '/api/debug/setup-admin' && request.method === 'POST') {
      return corsResponse(await handleDebugSetupAdmin(request, env));
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

async function handleUpdateUsername(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (!isAuthContext(authResult)) return authResult;

  const body = await request.json() as { newUsername?: string };
  const { newUsername } = body;

  if (!newUsername) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'BAD_REQUEST', message: '新用户名不能为空' }
    }, 400);
  }

  // 简单验证：6位以上
  if (newUsername.length < 6) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'BAD_REQUEST', message: '用户名至少6位' }
    }, 400);
  }

  // 检查用户名是否已存在
  const existingUser = await findUserByUsername(env.DB, newUsername);
  if (existingUser) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'CONFLICT', message: '用户名已被使用' }
    }, 409);
  }

  // 更新用户名
  await updateUsername(env.DB, authResult.user.id, newUsername);

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

// ==================== 调试函数 ====================

async function handleDebugInit(env: Env): Promise<Response> {
  // 检查是否已有管理员，如果有则禁止访问
  const adminExists = await hasAdminUser(env.DB);
  if (adminExists) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'FORBIDDEN', message: '管理员已存在，此接口已禁用' }
    }, 403);
  }

  const adminUsername = env.ADMIN_USERNAME;
  const adminPassword = env.ADMIN_PASSWORD;

  // 显示环境变量状态（脱敏）
  const debugInfo = {
    ADMIN_USERNAME: adminUsername || '(未设置)',
    ADMIN_PASSWORD: adminPassword ? `${adminPassword.substring(0, 2)}***${adminPassword.substring(adminPassword.length - 2)} (${adminPassword.length}位)` : '(未设置)',
  };

  // 检查环境变量
  if (!adminUsername || !adminPassword) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { 
        code: 'BAD_REQUEST', 
        message: `环境变量未配置`,
      },
      data: debugInfo
    } as ApiResponse, 400);
  }

  try {
    // 创建管理员
    const passwordHash = await hashPassword(adminPassword);
    const admin = await createUser(env.DB, {
      username: adminUsername,
      passwordHash,
      role: 'admin',
    });

    return jsonResponse<ApiResponse>({
      success: true,
      data: { message: '管理员创建成功', username: admin.username, id: admin.id, env: debugInfo }
    }, 201);
  } catch (error) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `创建失败: ${error instanceof Error ? error.message : String(error)}` },
      data: debugInfo
    } as ApiResponse, 500);
  }
}

async function handleDebugSetupAdmin(request: Request, env: Env): Promise<Response> {
  // 检查是否已有管理员，如果有则禁止访问
  const adminExists = await hasAdminUser(env.DB);
  if (adminExists) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'FORBIDDEN', message: '管理员已存在，此接口已禁用' }
    }, 403);
  }

  const body = await request.json() as { username?: string; password?: string };
  const { username, password } = body;

  // 验证输入
  if (!username || !password) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'BAD_REQUEST', message: '用户名和密码不能为空' }
    }, 400);
  }

  // 简单验证：6位以上
  if (username.length < 6) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'BAD_REQUEST', message: '用户名至少6位' }
    }, 400);
  }

  if (password.length < 6) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'BAD_REQUEST', message: '密码至少6位' }
    }, 400);
  }

  try {
    // 检查用户名是否已被使用
    const existingUser = await findUserByUsername(env.DB, username);
    if (existingUser) {
      return jsonResponse<ApiResponse>({
        success: false,
        error: { code: 'CONFLICT', message: '该用户名已被使用' }
      }, 409);
    }

    // 创建新管理员
    const passwordHash = await hashPassword(password);
    const admin = await createUser(env.DB, {
      username,
      passwordHash,
      role: 'admin',
    });

    return jsonResponse<ApiResponse>({
      success: true,
      data: { message: '管理员创建成功', username: admin.username, id: admin.id }
    }, 201);
  } catch (error) {
    return jsonResponse<ApiResponse>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: `操作失败: ${error instanceof Error ? error.message : String(error)}` }
    }, 500);
  }
}
