/**
 * Veridian Corp IT Service Agent — Frontend Application
 * 
 * Single Page Application handling chat, dashboard, requests,
 * tickets, knowledge base, and audit trail views.
 */

// ============================================================
//  STATE
// ============================================================
const state = {
  currentView: 'chat',
  sessionId: null,
  selectedEmployee: null,
  selectedEmail: null,
  selectedRequestId: null,
  requests: [],
  tickets: [],
  kbArticles: [],
  auditTrail: [],
  chatHistory: [],
  isProcessing: false
};

// ============================================================
//  INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initChat();
  loadRequests();
  loadKnowledgeBase();
  showToast('System online — Ready to assist', 'info');
});

// ============================================================
//  NAVIGATION
// ============================================================
function initNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

function switchView(viewName) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.querySelector(`[data-view="${viewName}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Update views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(`view-${viewName}`);
  if (view) view.classList.add('active');

  state.currentView = viewName;

  // Load data for the view
  switch (viewName) {
    case 'dashboard': loadDashboard(); break;
    case 'requests': renderRequests(); break;
    case 'tickets': loadTickets(); break;
    case 'kb': renderKnowledgeBase(); break;
    case 'audit': loadAuditTrail(); break;
  }
}

// ============================================================
//  CHAT
// ============================================================
function initChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('btn-send');
  const processAllBtn = document.getElementById('btn-process-all');
  const resetBtn = document.getElementById('btn-reset');
  const clearEmployeeBtn = document.getElementById('btn-clear-employee');

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  processAllBtn.addEventListener('click', processAllRequests);
  resetBtn.addEventListener('click', resetSystem);
  clearEmployeeBtn.addEventListener('click', clearEmployee);
}

function selectRequest(request) {
  state.selectedEmployee = request.employee;
  state.selectedEmail = request.email;
  state.selectedRequestId = request.id;

  // Highlight selected card
  document.querySelectorAll('.request-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`[data-request-id="${request.id}"]`);
  if (card) card.classList.add('selected');

  // Show employee info
  const infoBar = document.getElementById('employee-info-bar');
  const tag = document.getElementById('current-employee-tag');
  infoBar.style.display = 'flex';
  tag.textContent = `${request.employee} (${request.id})`;

  // Set the message
  const input = document.getElementById('chat-input');
  input.value = request.request;
  input.focus();
}

function clearEmployee() {
  state.selectedEmployee = null;
  state.selectedEmail = null;
  state.selectedRequestId = null;
  document.getElementById('employee-info-bar').style.display = 'none';
  document.querySelectorAll('.request-card').forEach(c => c.classList.remove('selected'));
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message || state.isProcessing) return;

  state.isProcessing = true;
  const sendBtn = document.getElementById('btn-send');
  sendBtn.disabled = true;

  // Remove welcome message
  const welcome = document.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  // Add employee message to chat
  const employeeName = state.selectedEmployee || 'Employee';
  addChatMessage('employee', message, employeeName);

  // Clear input
  input.value = '';
  input.style.height = 'auto';

  // Show processing indicator
  const processingEl = showProcessingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        employee_name: state.selectedEmployee || 'Anonymous Employee',
        employee_email: state.selectedEmail || '',
        request_id: state.selectedRequestId || null,
        session_id: state.sessionId
      })
    });

    const data = await response.json();
    state.sessionId = data.session_id;

    // Remove processing indicator
    processingEl.remove();

    // Add agent response
    addAgentResponse(data);

    // Show toast for escalations
    if (data.escalation) {
      showToast(`⚠️ Escalated: ${data.escalation.reason}`, 'warning');
    }

    if (data.ticket) {
      showToast(`📋 Ticket ${data.ticket.id} created`, 'success');
    }

  } catch (error) {
    processingEl.remove();
    addChatMessage('agent', '❌ Sorry, something went wrong. Please try again.', 'Agent');
    showToast('Error processing message', 'error');
    console.error('Chat error:', error);
  }

  state.isProcessing = false;
  sendBtn.disabled = false;
  clearEmployee();
}

function addChatMessage(role, content, sender) {
  const messagesEl = document.getElementById('chat-messages');
  const initials = sender ? sender.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;
  messageEl.innerHTML = `
    <div class="message-avatar">${role === 'agent' ? 'AI' : initials}</div>
    <div class="message-body">
      <div class="message-sender">${sender || role}</div>
      <div class="message-content">${escapeHtml(content)}</div>
    </div>
  `;

  messagesEl.appendChild(messageEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addAgentResponse(data) {
  const messagesEl = document.getElementById('chat-messages');

  const messageEl = document.createElement('div');
  messageEl.className = 'message agent';

  // Build meta tags
  let metaHtml = '<div class="message-meta">';
  metaHtml += `<span class="meta-tag intent">🎯 ${data.classification.label}</span>`;
  metaHtml += `<span class="meta-tag confidence">📊 ${Math.round(data.classification.confidence * 100)}% confidence</span>`;

  if (data.ticket) {
    metaHtml += `<span class="meta-tag ticket">📋 ${data.ticket.id}</span>`;
  }

  if (data.escalation) {
    const levelClass = data.escalation.level === 'critical' ? '' : data.escalation.level;
    metaHtml += `<span class="meta-tag escalation ${levelClass}">🚨 ${data.escalation.level.toUpperCase()}</span>`;
  }

  data.sources.forEach(s => {
    metaHtml += `<span class="meta-tag source" title="${escapeHtml(s.content)}">${s.id}: ${s.title}</span>`;
  });

  metaHtml += '</div>';

  // Sources panel
  let sourcesHtml = '';
  if (data.sources.length > 0) {
    sourcesHtml = '<div class="sources-panel"><h4>📚 Sources Referenced</h4>';
    data.sources.forEach(s => {
      sourcesHtml += `<div class="source-item"><span class="source-item-id">${s.id}</span> — ${escapeHtml(s.title)}: ${escapeHtml(s.content)}</div>`;
    });
    sourcesHtml += '</div>';
  }

  // Follow-up questions
  let followUpHtml = '';
  if (data.resolution.follow_up_questions && data.resolution.follow_up_questions.length > 0) {
    followUpHtml = '<div class="follow-up-section"><h4>❓ Follow-up Questions</h4>';
    data.resolution.follow_up_questions.forEach(q => {
      followUpHtml += `<div class="follow-up-question">${escapeHtml(q)}</div>`;
    });
    followUpHtml += '</div>';
  }

  // Escalation alert
  let escalationHtml = '';
  if (data.escalation) {
    escalationHtml = `<div class="escalation-alert ${data.escalation.level}">
      <h4>${data.escalation.level_info.icon} ${data.escalation.level_info.label} ESCALATION</h4>
      <p><strong>Target:</strong> ${escapeHtml(data.escalation.target)}</p>
      <p><strong>Reason:</strong> ${escapeHtml(data.escalation.reason)}</p>
      ${data.escalation.sla_hours ? `<p><strong>SLA:</strong> ${data.escalation.sla_hours} hours</p>` : ''}
    </div>`;
  }

  // Precedent tickets
  let precedentHtml = '';
  if (data.precedent_tickets && data.precedent_tickets.length > 0) {
    precedentHtml = '<div class="sources-panel"><h4>📑 Precedent Tickets</h4>';
    data.precedent_tickets.forEach(t => {
      precedentHtml += `<div class="source-item"><span class="source-item-id">${t.id}</span> — ${escapeHtml(t.employee)}: ${escapeHtml(t.summary)} [${t.status}]</div>`;
    });
    precedentHtml += '</div>';
  }

  messageEl.innerHTML = `
    <div class="message-avatar">AI</div>
    <div class="message-body">
      <div class="message-sender">IT Support Agent</div>
      <div class="message-content">${formatMarkdown(data.resolution.message)}</div>
      ${metaHtml}
      ${sourcesHtml}
      ${precedentHtml}
      ${followUpHtml}
      ${escalationHtml}
    </div>
  `;

  messagesEl.appendChild(messageEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  state.chatHistory.push(data);
}

function showProcessingIndicator() {
  const messagesEl = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'message agent';
  el.innerHTML = `
    <div class="message-avatar">AI</div>
    <div class="processing-indicator">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
      <span style="font-size:0.8rem; color: var(--text-muted)">Analyzing request...</span>
    </div>
  `;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

async function processAllRequests() {
  if (state.isProcessing) return;
  state.isProcessing = true;

  const btn = document.getElementById('btn-process-all');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Processing...';

  // Remove welcome
  const welcome = document.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  try {
    const response = await fetch('/api/process-all', { method: 'POST' });
    const data = await response.json();

    // Show results in chat
    const messagesEl = document.getElementById('chat-messages');
    const resultsEl = document.createElement('div');
    resultsEl.className = 'message agent';

    let resultsHtml = `
      <div class="message-avatar">AI</div>
      <div class="message-body">
        <div class="message-sender">IT Support Agent — Batch Processing</div>
        <div class="message-content">
          <strong>✅ Processed all ${data.processed} employee requests</strong>
          <br><br>
          Here's a summary of how each request was handled:
        </div>
        <div class="batch-results">
          <h3>📋 Processing Summary</h3>
    `;

    data.results.forEach(r => {
      const actionIcon = r.action_type === 'auto_resolve' ? '✅' :
                         r.action_type === 'escalate' ? '🚨' :
                         r.action_type === 'follow_up' ? '❓' :
                         r.action_type === 'redirect' ? '↗️' : '📝';
      const statusClass = r.escalated ? 'escalated' :
                          r.action_type === 'auto_resolve' ? 'resolved' :
                          r.action_type === 'follow_up' ? 'pending' : 'open';

      resultsHtml += `
        <div class="batch-result-item">
          <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-tertiary); width: 60px; flex-shrink: 0;">${r.request_id}</span>
          <span style="width: 130px; flex-shrink: 0; font-weight: 500;">${r.employee}</span>
          <span>${actionIcon}</span>
          <span class="status-badge ${statusClass}" style="font-size: 0.65rem;">${r.action_type.replace('_', ' ')}</span>
          <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: auto;">${r.intent_label}</span>
          ${r.ticket_id ? `<span class="meta-tag ticket" style="font-size: 0.65rem;">${r.ticket_id}</span>` : ''}
          ${r.sources.length > 0 ? `<span class="meta-tag source" style="font-size: 0.65rem;">${r.sources.join(', ')}</span>` : ''}
        </div>
      `;
    });

    resultsHtml += '</div></div>';
    resultsEl.innerHTML = resultsHtml;
    messagesEl.appendChild(resultsEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    showToast(`✅ Processed ${data.processed} requests successfully`, 'success');

  } catch (error) {
    console.error('Process all error:', error);
    showToast('Error processing requests', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    Process All Requests
  `;
  state.isProcessing = false;
}

async function resetSystem() {
  if (!confirm('Reset the system to its original state? This will clear all generated tickets and audit trail.')) return;

  try {
    await fetch('/api/reset', { method: 'POST' });
    state.sessionId = null;
    state.chatHistory = [];

    // Clear chat messages
    const messagesEl = document.getElementById('chat-messages');
    messagesEl.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">
          <svg viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="url(#welcomeGrad2)"/>
            <path d="M16 24L22 30L32 18" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <defs>
              <linearGradient id="welcomeGrad2" x1="0" y1="0" x2="48" y2="48">
                <stop stop-color="#6366f1"/>
                <stop offset="1" stop-color="#a78bfa"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h2>Welcome to Veridian Corp IT Support</h2>
        <p>System has been reset to its original state.</p>
        <p class="welcome-hint">Select a request from above or type your issue below to get started.</p>
      </div>
    `;

    clearEmployee();
    showToast('🔄 System reset to original state', 'info');
  } catch (error) {
    showToast('Error resetting system', 'error');
  }
}

// ============================================================
//  REQUESTS
// ============================================================
async function loadRequests() {
  try {
    const response = await fetch('/api/requests');
    state.requests = await response.json();
    renderRequestCards();
    renderRequests();
  } catch (error) {
    console.error('Failed to load requests:', error);
  }
}

function renderRequestCards() {
  const container = document.getElementById('request-cards');
  container.innerHTML = '';

  state.requests.forEach(req => {
    const statusClass = req.status === 'escalated' ? 'escalated' :
                        req.status === 'in_progress' ? 'in_progress' : 'open';
    const statusLabel = req.status === 'in_progress' ? 'In Progress' :
                        req.status === 'escalated' ? 'Escalated' : 'Open';

    const card = document.createElement('div');
    card.className = 'request-card';
    card.dataset.requestId = req.id;
    card.innerHTML = `
      <div class="request-card-id">${req.id}</div>
      <div class="request-card-name">${req.employee}</div>
      <div class="request-card-text">${req.request}</div>
      <span class="request-card-status ${statusClass}">${statusLabel}</span>
    `;
    card.addEventListener('click', () => selectRequest(req));
    container.appendChild(card);
  });
}

function renderRequests() {
  const container = document.getElementById('requests-content');
  if (state.requests.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No requests loaded</h3><p>Waiting for data...</p></div>';
    return;
  }

  let html = `
    <table class="request-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Employee</th>
          <th>Date</th>
          <th>Request</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  state.requests.forEach(req => {
    const statusClass = req.status === 'escalated' ? 'escalated' :
                        req.status === 'in_progress' ? 'in-progress' : 'open';
    const statusLabel = req.status === 'in_progress' ? 'In Progress' :
                        req.status === 'escalated' ? 'Escalated' : 'Open';

    html += `
      <tr>
        <td class="req-id">${req.id}</td>
        <td>
          <div class="req-name">${req.employee}</div>
          <div class="req-email">${req.email}</div>
        </td>
        <td>${req.day}</td>
        <td class="req-text">${req.request}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td><button class="req-action-btn" onclick="handleRequestFromTable('${req.id}')">Process →</button></td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function handleRequestFromTable(requestId) {
  const req = state.requests.find(r => r.id === requestId);
  if (req) {
    selectRequest(req);
    switchView('chat');
  }
}

// ============================================================
//  DASHBOARD
// ============================================================
async function loadDashboard() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = '<div style="text-align:center; padding:40px;"><div class="spinner"></div></div>';

  try {
    const response = await fetch('/api/dashboard/stats');
    const stats = await response.json();
    renderDashboard(stats);
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><h3>Failed to load dashboard</h3></div>';
  }
}

function renderDashboard(stats) {
  const container = document.getElementById('dashboard-content');

  const totalTickets = stats.tickets.total || 0;

  // Calculate category data for bars
  const categories = stats.tickets.by_category || {};
  const maxCatCount = Math.max(...Object.values(categories), 1);

  let categoryBarsHtml = '';
  const categoryLabels = {
    vpn_access: 'VPN Access',
    laptop_issue: 'Laptop Issues',
    software_install: 'Software Install',
    printer_issue: 'Printer Issues',
    email_quota: 'Email / Mailbox',
    guest_wifi: 'Guest Wi-Fi',
    security_incident: 'Security Incident',
    home_equipment: 'Home Equipment',
    password_reset: 'Password Reset',
    admin_access: 'Admin Access',
    expense_tool: 'Expense Tool',
    unclear: 'Unclear'
  };

  Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    const label = categoryLabels[cat] || cat;
    const pct = (count / maxCatCount) * 100;
    categoryBarsHtml += `
      <div class="category-bar">
        <span class="category-name">${label}</span>
        <div class="category-bar-fill">
          <div class="category-bar-fill-inner" style="width: ${pct}%"></div>
        </div>
        <span class="category-count">${count}</span>
      </div>
    `;
  });

  // Status breakdown
  let statusHtml = '';
  Object.entries(stats.tickets.by_status || {}).forEach(([status, count]) => {
    const badgeClass = status.toLowerCase().includes('resolved') ? 'resolved' :
                       status.toLowerCase().includes('escalated') ? 'escalated' :
                       status.toLowerCase().includes('approved') ? 'approved' :
                       status.toLowerCase().includes('rejected') ? 'rejected' :
                       status.toLowerCase().includes('pending') ? 'pending' : 'open';
    statusHtml += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
        <span class="status-badge ${badgeClass}">${status}</span>
        <span style="font-weight: 700; color: var(--text-primary);">${count}</span>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card primary">
        <div class="stat-value">${totalTickets}</div>
        <div class="stat-label">Total Tickets</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${stats.tickets.open || 0}</div>
        <div class="stat-label">Active Tickets</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">${stats.tickets.resolution_rate || 0}%</div>
        <div class="stat-label">Resolution Rate</div>
      </div>
      <div class="stat-card error">
        <div class="stat-value">${(stats.tickets.critical || 0) + (stats.tickets.high || 0)}</div>
        <div class="stat-label">Critical / High</div>
      </div>
    </div>

    <div class="dashboard-panels">
      <div class="panel">
        <div class="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Tickets by Category
        </div>
        ${categoryBarsHtml || '<p style="color: var(--text-muted); font-size: 0.85rem;">No data yet — process some requests first</p>'}
      </div>
      <div class="panel">
        <div class="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Status Breakdown
        </div>
        ${statusHtml || '<p style="color: var(--text-muted); font-size: 0.85rem;">No data yet — process some requests first</p>'}
      </div>
    </div>

    <div style="margin-top: 20px; padding: 16px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);">
      <div class="panel-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        System Information
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.85rem;">
        <div><span style="color: var(--text-muted);">Company:</span> <strong>${stats.system.company}</strong></div>
        <div><span style="color: var(--text-muted);">Period:</span> <strong>${stats.system.week}</strong></div>
        <div><span style="color: var(--text-muted);">Audit Entries:</span> <strong>${stats.audit.total_entries}</strong></div>
        <div><span style="color: var(--text-muted);">Server Uptime:</span> <strong>${Math.round(stats.system.uptime)}s</strong></div>
      </div>
    </div>
  `;
}

// ============================================================
//  TICKETS
// ============================================================
async function loadTickets() {
  const container = document.getElementById('tickets-content');
  container.innerHTML = '<div style="text-align:center; padding:40px;"><div class="spinner"></div></div>';

  try {
    const filterEl = document.getElementById('ticket-filter');
    let url = '/api/tickets';
    if (filterEl.value === 'open') url += '?is_closed=false';
    else if (filterEl.value === 'closed') url += '?is_closed=true';

    const response = await fetch(url);
    state.tickets = await response.json();
    renderTickets();

    // Listen for filter changes
    filterEl.removeEventListener('change', loadTickets);
    filterEl.addEventListener('change', loadTickets);
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><h3>Failed to load tickets</h3></div>';
  }
}

function renderTickets() {
  const container = document.getElementById('tickets-content');

  if (state.tickets.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No tickets found</h3><p>Process some requests to generate tickets.</p></div>';
    return;
  }

  let html = '<div class="ticket-grid">';

  state.tickets.forEach(ticket => {
    const priorityClass = `priority-${ticket.priority || 'medium'}`;
    const statusBadge = getStatusBadgeClass(ticket.status);

    html += `
      <div class="ticket-card ${priorityClass}">
        <div class="ticket-header">
          <span class="ticket-id">${ticket.id}</span>
          <span class="status-badge ${statusBadge}">${ticket.status}</span>
        </div>
        <div class="ticket-employee">${ticket.employee}</div>
        <div class="ticket-summary">${ticket.issue_summary}</div>
        ${ticket.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 8px; padding: 8px; background: var(--bg-tertiary); border-radius: var(--radius-sm);">${escapeHtml(typeof ticket.notes === 'string' ? ticket.notes.split('\n')[0] : '')}</div>` : ''}
        <div class="ticket-footer">
          <span class="ticket-date">📅 ${ticket.date_created}</span>
          ${ticket.kb_reference ? `<span class="ticket-kb-ref">📚 ${ticket.kb_reference}</span>` : ''}
          ${ticket.request_id ? `<span style="font-size: 0.7rem; color: var(--text-muted);">${ticket.request_id}</span>` : ''}
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

function getStatusBadgeClass(status) {
  const s = status.toLowerCase();
  if (s.includes('resolved')) return 'resolved';
  if (s.includes('escalated')) return 'escalated';
  if (s.includes('approved')) return 'approved';
  if (s.includes('rejected')) return 'rejected';
  if (s.includes('pending')) return 'pending';
  if (s.includes('redirected')) return 'redirected';
  if (s.includes('open') || s.includes('investigating')) return 'open';
  return 'open';
}

// ============================================================
//  KNOWLEDGE BASE
// ============================================================
async function loadKnowledgeBase() {
  try {
    const response = await fetch('/api/kb');
    state.kbArticles = await response.json();
  } catch (error) {
    console.error('Failed to load KB:', error);
  }
}

function renderKnowledgeBase() {
  const container = document.getElementById('kb-content');

  if (state.kbArticles.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>Knowledge base is empty</h3></div>';
    return;
  }

  let html = '<div class="kb-grid">';

  state.kbArticles.forEach(article => {
    let stepsHtml = '';
    if (article.resolution_steps) {
      stepsHtml = '<ul class="kb-card-steps">';
      article.resolution_steps.forEach(step => {
        stepsHtml += `<li>${escapeHtml(step)}</li>`;
      });
      stepsHtml += '</ul>';
    }

    let tagsHtml = '<div class="kb-card-tags">';
    (article.keywords || []).slice(0, 6).forEach(kw => {
      tagsHtml += `<span class="kb-tag">${kw}</span>`;
    });
    tagsHtml += '</div>';

    const autoResolveTag = article.auto_resolvable
      ? '<span class="status-badge resolved" style="font-size: 0.6rem; margin-left: 8px;">Auto-Resolvable</span>'
      : article.requires_approval
        ? '<span class="status-badge pending" style="font-size: 0.6rem; margin-left: 8px;">Needs Approval</span>'
        : '';

    html += `
      <div class="kb-card">
        <div class="kb-card-header">
          <span class="kb-card-id">${article.id}</span>
          <span class="kb-card-title">${article.title}</span>
          ${autoResolveTag}
        </div>
        <div class="kb-card-content">${escapeHtml(article.content)}</div>
        ${stepsHtml}
        ${tagsHtml}
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ============================================================
//  AUDIT TRAIL
// ============================================================
async function loadAuditTrail() {
  const container = document.getElementById('audit-content');
  container.innerHTML = '<div style="text-align:center; padding:40px;"><div class="spinner"></div></div>';

  try {
    const response = await fetch('/api/audit');
    state.auditTrail = await response.json();
    renderAuditTrail();
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><h3>Failed to load audit trail</h3></div>';
  }

  // Bind refresh button
  document.getElementById('btn-refresh-audit').addEventListener('click', loadAuditTrail);
}

function renderAuditTrail() {
  const container = document.getElementById('audit-content');

  if (state.auditTrail.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <h3>No audit entries yet</h3>
        <p>Process some requests to see the audit trail.</p>
      </div>
    `;
    return;
  }

  let html = '<div class="audit-timeline">';

  // Show in reverse chronological order
  [...state.auditTrail].reverse().forEach(entry => {
    const time = new Date(entry.timestamp).toLocaleString();
    const actionType = entry.action_type || 'unknown';

    let tagsHtml = '<div class="audit-tags">';
    if (entry.classification.intent) {
      tagsHtml += `<span class="audit-tag intent">${entry.classification.intent}</span>`;
    }
    if (entry.ticket_id) {
      tagsHtml += `<span class="audit-tag ticket">${entry.ticket_id}</span>`;
    }
    if (entry.kb_articles_referenced && entry.kb_articles_referenced.length > 0) {
      entry.kb_articles_referenced.forEach(kb => {
        tagsHtml += `<span class="audit-tag kb">${kb}</span>`;
      });
    }
    if (entry.request_id) {
      tagsHtml += `<span class="audit-tag request">${entry.request_id}</span>`;
    }
    tagsHtml += '</div>';

    html += `
      <div class="audit-entry action-${actionType}">
        <div class="audit-header">
          <span class="audit-timestamp">${time}</span>
          <span class="audit-action-type ${actionType}">${actionType.replace('_', ' ')}</span>
        </div>
        <div class="audit-employee">${entry.employee.name} ${entry.employee.email ? `(${entry.employee.email})` : ''}</div>
        ${entry.interaction.message_received ? `<div class="audit-details"><strong>Message:</strong> "${escapeHtml(entry.interaction.message_received)}"</div>` : ''}
        ${entry.resolution_summary ? `<div class="audit-details"><strong>Resolution:</strong> ${escapeHtml(entry.resolution_summary)}</div>` : ''}
        ${entry.escalation.level ? `<div class="audit-details" style="color: var(--error);"><strong>Escalation:</strong> ${entry.escalation.level.toUpperCase()} → ${escapeHtml(entry.escalation.target || 'N/A')}</div>` : ''}
        ${entry.classification.confidence ? `<div class="audit-details"><strong>Confidence:</strong> ${Math.round(entry.classification.confidence * 100)}%</div>` : ''}
        ${tagsHtml}
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ============================================================
//  UTILITIES
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatMarkdown(text) {
  if (!text) return '';
  // Convert markdown-like formatting to HTML
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background: var(--bg-tertiary); padding: 1px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.85em;">$1</code>')
    .replace(/\n/g, '<br>')
    .replace(/#{1,3}\s(.+)/g, '<h3>$1</h3>')
    .replace(/- (.*)/g, '• $1');
}

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Global function for table button clicks
window.handleRequestFromTable = handleRequestFromTable;
