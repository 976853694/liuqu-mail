import type { Env, ApiResponse, CreateMailboxResponse, EmailSummary, EmailDetail } from './types';
import { createMailbox, validateMailboxAccess, getMailboxByAddress } from './db/mailbox';
import { getEmailsByMailbox, getEmailById } from './db/email';

// 速率限制存储 (简单实现，生产环境建议使用 KV 或 Durable Objects)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// 内嵌前端 HTML
const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>临时邮箱 - Temp Email</title>
  <style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --primary-color: #3b82f6; --primary-hover: #2563eb; --bg-color: #f8fafc; --card-bg: #ffffff; --text-color: #1e293b; --text-secondary: #64748b; --border-color: #e2e8f0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: var(--bg-color); color: var(--text-color); line-height: 1.6; min-height: 100vh; }
.container { max-width: 600px; margin: 0 auto; padding: 20px; min-height: 100vh; display: flex; flex-direction: column; }
header { text-align: center; padding: 40px 0 30px; }
header h1 { font-size: 2rem; margin-bottom: 10px; }
.subtitle { color: var(--text-secondary); }
main { flex: 1; }
.view { animation: fadeIn 0.3s ease; }
.hidden { display: none !important; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.btn-primary { width: 100%; padding: 16px 24px; font-size: 1.1rem; font-weight: 600; color: white; background-color: var(--primary-color); border: none; border-radius: 12px; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
.btn-primary:hover { background-color: var(--primary-hover); }
.btn-primary:active { transform: scale(0.98); }
.btn-secondary { padding: 10px 20px; font-size: 0.9rem; color: var(--text-color); background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; }
.btn-secondary:hover { background-color: var(--bg-color); }
.btn-icon { padding: 8px; background: none; border: none; cursor: pointer; font-size: 1.2rem; border-radius: 6px; }
.btn-icon:hover { background-color: var(--bg-color); }
.btn-back { padding: 10px 0; background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 1rem; margin-bottom: 20px; }
.mailbox-header { background-color: var(--card-bg); padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.email-address-container { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.email-address { font-size: 1.1rem; font-weight: 600; color: var(--primary-color); word-break: break-all; }
.expiry-info { font-size: 0.9rem; color: var(--text-secondary); }
.email-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.email-list-header h2 { font-size: 1.2rem; }
.email-list { background-color: var(--card-bg); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
.email-item { padding: 15px 20px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background-color 0.2s; }
.email-item:last-child { border-bottom: none; }
.email-item:hover { background-color: var(--bg-color); }
.email-item-from { font-weight: 600; margin-bottom: 4px; }
.email-item-subject { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.email-item-time { font-size: 0.8rem; color: var(--text-secondary); }
.empty-state { padding: 40px 20px; text-align: center; color: var(--text-secondary); }
.empty-state p:first-child { font-size: 2rem; margin-bottom: 10px; }
.email-detail { background-color: var(--card-bg); border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.email-header { border-bottom: 1px solid var(--border-color); padding-bottom: 15px; margin-bottom: 15px; }
.email-header h2 { font-size: 1.3rem; margin-bottom: 10px; }
.email-meta { display: flex; flex-direction: column; gap: 5px; font-size: 0.9rem; color: var(--text-secondary); }
.email-body { white-space: pre-wrap; word-break: break-word; line-height: 1.8; }
.toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); padding: 12px 24px; background-color: var(--text-color); color: white; border-radius: 8px; font-size: 0.9rem; z-index: 1000; }
footer { text-align: center; padding: 20px 0; color: var(--text-secondary); font-size: 0.85rem; }
@media (max-width: 480px) { .container { padding: 15px; } header { padding: 30px 0 20px; } header h1 { font-size: 1.6rem; } }
  </style>
</head>
<body>
  <div class="container">
    <header><h1>📧 临时邮箱</h1><p class="subtitle">快速获取一个临时邮箱地址，用于接收验证邮件</p></header>
    <main>
      <div id="home-view" class="view">
        <button id="create-mailbox-btn" class="btn-primary">生成临时邮箱</button>
        <div id="saved-mailbox" class="saved-mailbox hidden"><p>上次使用的邮箱：</p><div class="mailbox-card" id="saved-mailbox-card"></div></div>
      </div>
      <div id="mailbox-view" class="view hidden">
        <div class="mailbox-header">
          <div class="email-address-container"><span id="email-address" class="email-address"></span><button id="copy-btn" class="btn-icon" title="复制邮箱地址">📋</button></div>
          <div class="expiry-info"><span>过期时间：</span><span id="expiry-countdown"></span></div>
        </div>
        <div class="email-list-header"><h2>收件箱</h2><button id="refresh-btn" class="btn-secondary">🔄 刷新</button></div>
        <div id="email-list" class="email-list"><div class="empty-state"><p>📭 暂无邮件</p><p class="hint">等待邮件到达...</p></div></div>
        <button id="new-mailbox-btn" class="btn-secondary">生成新邮箱</button>
      </div>
      <div id="email-detail-view" class="view hidden">
        <button id="back-btn" class="btn-back">← 返回列表</button>
        <div class="email-detail">
          <div class="email-header"><h2 id="email-subject">邮件主题</h2><div class="email-meta"><span>发件人：<span id="email-from"></span></span><span>时间：<span id="email-time"></span></span></div></div>
          <div id="email-body" class="email-body"></div>
        </div>
      </div>
    </main>
    <footer><p>基于 Cloudflare Workers 构建</p></footer>
  </div>
  <div id="toast" class="toast hidden"></div>
  <script>
const API_BASE='/api';let currentMailbox=null,refreshInterval=null;const homeView=document.getElementById('home-view'),mailboxView=document.getElementById('mailbox-view'),emailDetailView=document.getElementById('email-detail-view'),createMailboxBtn=document.getElementById('create-mailbox-btn'),savedMailbox=document.getElementById('saved-mailbox'),savedMailboxCard=document.getElementById('saved-mailbox-card'),emailAddress=document.getElementById('email-address'),copyBtn=document.getElementById('copy-btn'),expiryCountdown=document.getElementById('expiry-countdown'),refreshBtn=document.getElementById('refresh-btn'),emailList=document.getElementById('email-list'),newMailboxBtn=document.getElementById('new-mailbox-btn'),backBtn=document.getElementById('back-btn'),emailSubject=document.getElementById('email-subject'),emailFrom=document.getElementById('email-from'),emailTime=document.getElementById('email-time'),emailBody=document.getElementById('email-body');document.addEventListener('DOMContentLoaded',()=>{loadSavedMailbox();setupEventListeners()});function setupEventListeners(){createMailboxBtn.addEventListener('click',createNewMailbox);copyBtn.addEventListener('click',copyEmailAddress);refreshBtn.addEventListener('click',refreshEmails);newMailboxBtn.addEventListener('click',createNewMailbox);backBtn.addEventListener('click',showMailboxView);savedMailboxCard.addEventListener('click',()=>{if(currentMailbox)showMailboxView()})}function loadSavedMailbox(){const saved=localStorage.getItem('tempMailbox');if(saved){try{currentMailbox=JSON.parse(saved);if(new Date(currentMailbox.expiresAt)>new Date()){savedMailboxCard.textContent=currentMailbox.address;savedMailbox.classList.remove('hidden')}else{localStorage.removeItem('tempMailbox');currentMailbox=null}}catch(e){localStorage.removeItem('tempMailbox')}}}async function createNewMailbox(){try{createMailboxBtn.disabled=true;createMailboxBtn.textContent='创建中...';const response=await fetch(API_BASE+'/mailbox',{method:'POST'});const result=await response.json();if(!result.success)throw new Error(result.error?.message||'创建失败');currentMailbox=result.data;localStorage.setItem('tempMailbox',JSON.stringify(currentMailbox));showMailboxView();showToast('邮箱创建成功！')}catch(error){showToast('创建失败：'+error.message)}finally{createMailboxBtn.disabled=false;createMailboxBtn.textContent='生成临时邮箱'}}function showMailboxView(){if(!currentMailbox)return;homeView.classList.add('hidden');emailDetailView.classList.add('hidden');mailboxView.classList.remove('hidden');emailAddress.textContent=currentMailbox.address;updateExpiryCountdown();refreshEmails();if(refreshInterval)clearInterval(refreshInterval);refreshInterval=setInterval(()=>{refreshEmails();updateExpiryCountdown()},10000)}function showHomeView(){if(refreshInterval){clearInterval(refreshInterval);refreshInterval=null}mailboxView.classList.add('hidden');emailDetailView.classList.add('hidden');homeView.classList.remove('hidden');loadSavedMailbox()}function updateExpiryCountdown(){if(!currentMailbox)return;const expiresAt=new Date(currentMailbox.expiresAt),now=new Date(),diff=expiresAt-now;if(diff<=0){expiryCountdown.textContent='已过期';localStorage.removeItem('tempMailbox');showToast('邮箱已过期');setTimeout(showHomeView,2000);return}const hours=Math.floor(diff/(1000*60*60)),minutes=Math.floor((diff%(1000*60*60))/(1000*60));expiryCountdown.textContent=hours+'小时 '+minutes+'分钟'}async function copyEmailAddress(){if(!currentMailbox)return;try{await navigator.clipboard.writeText(currentMailbox.address);showToast('已复制到剪贴板')}catch(error){const textarea=document.createElement('textarea');textarea.value=currentMailbox.address;document.body.appendChild(textarea);textarea.select();document.execCommand('copy');document.body.removeChild(textarea);showToast('已复制到剪贴板')}}async function refreshEmails(){if(!currentMailbox)return;try{const response=await fetch(API_BASE+'/mailbox/'+encodeURIComponent(currentMailbox.address)+'/emails',{headers:{'Authorization':'Bearer '+currentMailbox.token}});const result=await response.json();if(!result.success){if(response.status===401){localStorage.removeItem('tempMailbox');showToast('邮箱已失效');showHomeView();return}throw new Error(result.error?.message||'获取失败')}renderEmailList(result.data.emails)}catch(error){console.error('刷新邮件失败:',error)}}function renderEmailList(emails){if(!emails||emails.length===0){emailList.innerHTML='<div class="empty-state"><p>📭 暂无邮件</p><p class="hint">等待邮件到达...</p></div>';return}emailList.innerHTML=emails.map(email=>'<div class="email-item" data-id="'+email.id+'"><div class="email-item-from">'+escapeHtml(email.from)+'</div><div class="email-item-subject">'+escapeHtml(email.subject||'(无主题)')+'</div><div class="email-item-time">'+formatTime(email.receivedAt)+'</div></div>').join('');emailList.querySelectorAll('.email-item').forEach(item=>{item.addEventListener('click',()=>showEmailDetail(item.dataset.id))})}async function showEmailDetail(emailId){if(!currentMailbox)return;try{const response=await fetch(API_BASE+'/mailbox/'+encodeURIComponent(currentMailbox.address)+'/emails/'+emailId,{headers:{'Authorization':'Bearer '+currentMailbox.token}});const result=await response.json();if(!result.success)throw new Error(result.error?.message||'获取失败');const email=result.data;emailSubject.textContent=email.subject||'(无主题)';emailFrom.textContent=email.from;emailTime.textContent=formatTime(email.receivedAt);emailBody.textContent=email.body||'(无内容)';mailboxView.classList.add('hidden');emailDetailView.classList.remove('hidden')}catch(error){showToast('获取邮件失败：'+error.message)}}function showToast(message){const toast=document.getElementById('toast');toast.textContent=message;toast.classList.remove('hidden');setTimeout(()=>{toast.classList.add('hidden')},3000)}function formatTime(isoString){const date=new Date(isoString),now=new Date(),diff=now-date;if(diff<60000)return'刚刚';if(diff<3600000)return Math.floor(diff/60000)+' 分钟前';if(diff<86400000)return Math.floor(diff/3600000)+' 小时前';return date.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}function escapeHtml(text){if(!text)return'';const div=document.createElement('div');div.textContent=text;return div.innerHTML}
  </script>
</body>
</html>`;

/**
 * 处理 API 请求
 */
export async function handleApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检请求
  if (request.method === 'OPTIONS') {
    return corsResponse(new Response(null, { status: 204 }));
  }

  // 速率限制检查
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitResult = checkRateLimit(clientIP, parseInt(env.RATE_LIMIT_PER_MINUTE || '60'));
  if (!rateLimitResult.allowed) {
    return corsResponse(jsonResponse<ApiResponse>(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      429
    ));
  }

  try {
    // 路由处理
    if (path === '/api/mailbox' && request.method === 'POST') {
      return corsResponse(await handleCreateMailbox(env));
    }

    const emailListMatch = path.match(/^\/api\/mailbox\/([^/]+)\/emails$/);
    if (emailListMatch && request.method === 'GET') {
      const address = decodeURIComponent(emailListMatch[1]);
      return corsResponse(await handleGetEmails(request, env, address));
    }

    const emailDetailMatch = path.match(/^\/api\/mailbox\/([^/]+)\/emails\/([^/]+)$/);
    if (emailDetailMatch && request.method === 'GET') {
      const address = decodeURIComponent(emailDetailMatch[1]);
      const emailId = emailDetailMatch[2];
      return corsResponse(await handleGetEmailDetail(request, env, address, emailId));
    }

    // 静态文件请求交给前端处理
    if (!path.startsWith('/api/')) {
      // 返回内嵌的前端页面
      return new Response(FRONTEND_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return corsResponse(jsonResponse<ApiResponse>(
      { success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
      404
    ));
  } catch (error) {
    console.error('API Error:', error);
    return corsResponse(jsonResponse<ApiResponse>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      500
    ));
  }
}

/**
 * 创建邮箱
 */
async function handleCreateMailbox(env: Env): Promise<Response> {
  const retentionHours = parseInt(env.RETENTION_HOURS || '24');
  const mailbox = await createMailbox(env.DB, env.EMAIL_DOMAIN, retentionHours);

  const response: CreateMailboxResponse = {
    address: mailbox.address,
    token: mailbox.token,
    expiresAt: mailbox.expires_at,
  };

  return jsonResponse<ApiResponse<CreateMailboxResponse>>({
    success: true,
    data: response,
  }, 201);
}

/**
 * 获取邮件列表
 */
async function handleGetEmails(
  request: Request,
  env: Env,
  address: string
): Promise<Response> {
  const token = extractToken(request);
  if (!token) {
    return jsonResponse<ApiResponse>(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' } },
      401
    );
  }

  const mailbox = await validateMailboxAccess(env.DB, address, token);
  if (!mailbox) {
    return jsonResponse<ApiResponse>(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token or mailbox not found' } },
      401
    );
  }

  const emails = await getEmailsByMailbox(env.DB, mailbox.id);

  return jsonResponse<ApiResponse<{ emails: EmailSummary[] }>>({
    success: true,
    data: { emails },
  });
}

/**
 * 获取邮件详情
 */
async function handleGetEmailDetail(
  request: Request,
  env: Env,
  address: string,
  emailId: string
): Promise<Response> {
  const token = extractToken(request);
  if (!token) {
    return jsonResponse<ApiResponse>(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' } },
      401
    );
  }

  const mailbox = await validateMailboxAccess(env.DB, address, token);
  if (!mailbox) {
    return jsonResponse<ApiResponse>(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token or mailbox not found' } },
      401
    );
  }

  const email = await getEmailById(env.DB, emailId, mailbox.id);
  if (!email) {
    return jsonResponse<ApiResponse>(
      { success: false, error: { code: 'NOT_FOUND', message: 'Email not found' } },
      404
    );
  }

  return jsonResponse<ApiResponse<EmailDetail>>({
    success: true,
    data: email,
  });
}

/**
 * 从请求头提取令牌
 */
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return authHeader;
}

/**
 * 检查速率限制
 */
function checkRateLimit(key: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 分钟窗口
  
  let entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitMap.set(key, entry);
  }
  
  entry.count++;
  
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
  };
}

/**
 * JSON 响应
 */
function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 添加 CORS 头
 */
function corsResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
