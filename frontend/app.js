// API 基础 URL (开发时可修改)
const API_BASE = '/api';

// 状态管理
let currentMailbox = null;
let refreshInterval = null;

// DOM 元素
const homeView = document.getElementById('home-view');
const mailboxView = document.getElementById('mailbox-view');
const emailDetailView = document.getElementById('email-detail-view');
const createMailboxBtn = document.getElementById('create-mailbox-btn');
const savedMailbox = document.getElementById('saved-mailbox');
const savedMailboxCard = document.getElementById('saved-mailbox-card');
const emailAddress = document.getElementById('email-address');
const copyBtn = document.getElementById('copy-btn');
const expiryCountdown = document.getElementById('expiry-countdown');
const refreshBtn = document.getElementById('refresh-btn');
const emailList = document.getElementById('email-list');
const newMailboxBtn = document.getElementById('new-mailbox-btn');
const backBtn = document.getElementById('back-btn');
const emailSubject = document.getElementById('email-subject');
const emailFrom = document.getElementById('email-from');
const emailTime = document.getElementById('email-time');
const emailBody = document.getElementById('email-body');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSavedMailbox();
  setupEventListeners();
});

// 设置事件监听
function setupEventListeners() {
  createMailboxBtn.addEventListener('click', createNewMailbox);
  copyBtn.addEventListener('click', copyEmailAddress);
  refreshBtn.addEventListener('click', refreshEmails);
  newMailboxBtn.addEventListener('click', createNewMailbox);
  backBtn.addEventListener('click', showMailboxView);
  savedMailboxCard.addEventListener('click', () => {
    if (currentMailbox) {
      showMailboxView();
    }
  });
}

// 加载保存的邮箱
function loadSavedMailbox() {
  const saved = localStorage.getItem('tempMailbox');
  if (saved) {
    try {
      currentMailbox = JSON.parse(saved);
      // 检查是否过期
      if (new Date(currentMailbox.expiresAt) > new Date()) {
        savedMailboxCard.textContent = currentMailbox.address;
        savedMailbox.classList.remove('hidden');
      } else {
        localStorage.removeItem('tempMailbox');
        currentMailbox = null;
      }
    } catch (e) {
      localStorage.removeItem('tempMailbox');
    }
  }
}

// 创建新邮箱
async function createNewMailbox() {
  try {
    createMailboxBtn.disabled = true;
    createMailboxBtn.textContent = '创建中...';

    const response = await fetch(`${API_BASE}/mailbox`, {
      method: 'POST',
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || '创建失败');
    }

    currentMailbox = result.data;
    localStorage.setItem('tempMailbox', JSON.stringify(currentMailbox));
    
    showMailboxView();
    showToast('邮箱创建成功！');
  } catch (error) {
    showToast('创建失败：' + error.message);
  } finally {
    createMailboxBtn.disabled = false;
    createMailboxBtn.textContent = '生成临时邮箱';
  }
}

// 显示邮箱视图
function showMailboxView() {
  if (!currentMailbox) return;

  homeView.classList.add('hidden');
  emailDetailView.classList.add('hidden');
  mailboxView.classList.remove('hidden');

  emailAddress.textContent = currentMailbox.address;
  updateExpiryCountdown();
  refreshEmails();

  // 启动自动刷新
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    refreshEmails();
    updateExpiryCountdown();
  }, 10000); // 每 10 秒刷新
}

// 显示首页
function showHomeView() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }

  mailboxView.classList.add('hidden');
  emailDetailView.classList.add('hidden');
  homeView.classList.remove('hidden');

  loadSavedMailbox();
}

// 更新过期倒计时
function updateExpiryCountdown() {
  if (!currentMailbox) return;

  const expiresAt = new Date(currentMailbox.expiresAt);
  const now = new Date();
  const diff = expiresAt - now;

  if (diff <= 0) {
    expiryCountdown.textContent = '已过期';
    localStorage.removeItem('tempMailbox');
    showToast('邮箱已过期');
    setTimeout(showHomeView, 2000);
    return;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  expiryCountdown.textContent = `${hours}小时 ${minutes}分钟`;
}

// 复制邮箱地址
async function copyEmailAddress() {
  if (!currentMailbox) return;

  try {
    await navigator.clipboard.writeText(currentMailbox.address);
    showToast('已复制到剪贴板');
  } catch (error) {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = currentMailbox.address;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('已复制到剪贴板');
  }
}

// 刷新邮件列表
async function refreshEmails() {
  if (!currentMailbox) return;

  try {
    const response = await fetch(
      `${API_BASE}/mailbox/${encodeURIComponent(currentMailbox.address)}/emails`,
      {
        headers: {
          'Authorization': `Bearer ${currentMailbox.token}`,
        },
      }
    );

    const result = await response.json();

    if (!result.success) {
      if (response.status === 401) {
        localStorage.removeItem('tempMailbox');
        showToast('邮箱已失效');
        showHomeView();
        return;
      }
      throw new Error(result.error?.message || '获取失败');
    }

    renderEmailList(result.data.emails);
  } catch (error) {
    console.error('刷新邮件失败:', error);
  }
}

// 渲染邮件列表
function renderEmailList(emails) {
  if (!emails || emails.length === 0) {
    emailList.innerHTML = `
      <div class="empty-state">
        <p>📭 暂无邮件</p>
        <p class="hint">等待邮件到达...</p>
      </div>
    `;
    return;
  }

  emailList.innerHTML = emails.map(email => `
    <div class="email-item" data-id="${email.id}">
      <div class="email-item-from">${escapeHtml(email.from)}</div>
      <div class="email-item-subject">${escapeHtml(email.subject || '(无主题)')}</div>
      <div class="email-item-time">${formatTime(email.receivedAt)}</div>
    </div>
  `).join('');

  // 添加点击事件
  emailList.querySelectorAll('.email-item').forEach(item => {
    item.addEventListener('click', () => showEmailDetail(item.dataset.id));
  });
}

// 显示邮件详情
async function showEmailDetail(emailId) {
  if (!currentMailbox) return;

  try {
    const response = await fetch(
      `${API_BASE}/mailbox/${encodeURIComponent(currentMailbox.address)}/emails/${emailId}`,
      {
        headers: {
          'Authorization': `Bearer ${currentMailbox.token}`,
        },
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || '获取失败');
    }

    const email = result.data;
    emailSubject.textContent = email.subject || '(无主题)';
    emailFrom.textContent = email.from;
    emailTime.textContent = formatTime(email.receivedAt);
    emailBody.textContent = email.body || '(无内容)';

    mailboxView.classList.add('hidden');
    emailDetailView.classList.remove('hidden');
  } catch (error) {
    showToast('获取邮件失败：' + error.message);
  }
}

// 显示 Toast 提示
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// 格式化时间
function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} 分钟前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)} 小时前`;
  } else {
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

// HTML 转义
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
