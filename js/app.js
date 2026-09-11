/* ==========================================================================
   KwikSel — Application
   Vanilla JS SPA. All functions are global (non-module script) so inline
   event handler attributes (onclick="...") can call them directly.
   ========================================================================== */

/* ---------------------------- Global state ------------------------------ */
let state = loadData();

// Transient UI state (not persisted, except theme which lives in state.settings).
let ui = {
  route: 'dashboard',
  sidebarOpen: false,
  leadsView: 'kanban',
  leadsSearch: '',
  leadsStatusFilter: 'all',
  leadsDateFrom: '',
  leadsDateTo: '',
  leadsSort: 'createdDesc',
  leadsPage: 1,
  templatesFilter: { category: 'all', language: 'all', favOnly: false, search: '' },
  previewLeadId: null,
  followupsTab: 'overdue',
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Icon.dashboard },
  { id: 'leads', label: 'Leads', icon: Icon.leads },
  { id: 'templates', label: 'Templates', icon: Icon.templates },
  { id: 'followups', label: 'Follow-ups', icon: Icon.followups },
  { id: 'settings', label: 'Settings', icon: Icon.settings },
];

const STATUS_TO_TEMPLATE_CATEGORIES = {
  'New': ['welcome'],
  'Replied': ['price', 'thinking'],
  'Interested': ['price', 'order'],
  'Follow-up': ['followup', 'payment'],
  'Won': ['order', 'delivery'],
  'Lost': ['thinking', 'followup'],
};

/* ------------------------------ Persistence ------------------------------ */
function persist() {
  const ok = saveData(state);
  if (!ok) showToast("Couldn't save your changes — your browser storage may be full.", 'error');
}

/* -------------------------------- Theme ---------------------------------- */
function applyTheme() {
  const theme = state.settings.theme || 'system';
  const effective = theme === 'system'
    ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.setAttribute('data-theme', effective);
}
function setThemePref(theme) {
  state.settings.theme = theme;
  persist();
  render();
}
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.settings.theme === 'system') applyTheme();
  });
}

/* -------------------------------- Routing --------------------------------- */
const VALID_ROUTES = ['dashboard', 'leads', 'templates', 'followups', 'settings'];
function getRoute() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  return VALID_ROUTES.includes(h) ? h : 'dashboard';
}
function navigateTo(id) {
  location.hash = '#/' + id;
}
window.addEventListener('hashchange', render);

function pageTitle() {
  const found = NAV_ITEMS.find(n => n.id === ui.route);
  return found ? found.label : 'KwikSel';
}

/* --------------------------------- Render --------------------------------- */
function render() {
  ui.route = getRoute();
  applyTheme();
  const content = pageContent();
  document.getElementById('app').innerHTML = layout(content);
  if (ui.route === 'dashboard') animateKPIs();
  if (ui.route === 'leads' && ui.leadsView === 'kanban') attachKanbanDragHandlers();
}

function pageContent() {
  switch (ui.route) {
    case 'leads': return renderLeadsPage();
    case 'templates': return renderTemplatesPage();
    case 'followups': return renderFollowupsPage();
    case 'settings': return renderSettingsPage();
    default: return renderDashboardPage();
  }
}

function layout(content) {
  const overdueCount = state.leads.filter(l => l.nextFollowUp && isOverdue(l.nextFollowUp)).length;
  return `
    <div class="sidebar-scrim" onclick="closeSidebar()"></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-mark">K</div>
        <div class="sidebar-brand-text">
          <div class="name">KwikSel</div>
          <div class="tagline">Your WhatsApp Sales Desk</div>
        </div>
      </div>
      <nav class="sidebar-nav" aria-label="Main navigation">
        ${NAV_ITEMS.map(n => `
          <button class="nav-item ${ui.route === n.id ? 'active' : ''}" onclick="navigateTo('${n.id}')" aria-current="${ui.route === n.id ? 'page' : 'false'}">
            ${n.icon}<span>${n.label}</span>
            ${n.id === 'followups' && overdueCount ? `<span class="badge-count">${overdueCount}</span>` : ''}
          </button>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="theme-switch" role="group" aria-label="Theme">
          <button class="${state.settings.theme === 'light' ? 'active' : ''}" onclick="setThemePref('light')" aria-label="Light theme">${Icon.sun}</button>
          <button class="${state.settings.theme === 'dark' ? 'active' : ''}" onclick="setThemePref('dark')" aria-label="Dark theme">${Icon.moon}</button>
          <button class="${state.settings.theme === 'system' ? 'active' : ''}" onclick="setThemePref('system')" aria-label="Match system theme">${Icon.monitor}</button>
        </div>
      </div>
    </aside>
    <div class="main-col">
      <header class="topbar">
        <button class="hamburger" onclick="openSidebar()" aria-label="Open menu">${Icon.menu}</button>
        <h1>${pageTitle()}</h1>
        <div class="topbar-spacer"></div>
      </header>
      <main id="main-content" tabindex="-1">${content}</main>
    </div>
    <nav class="bottom-nav" aria-label="Primary">
      ${NAV_ITEMS.map(n => `
        <button class="bottom-nav-item ${ui.route === n.id ? 'active' : ''}" onclick="navigateTo('${n.id}')" aria-current="${ui.route === n.id ? 'page' : 'false'}">
          ${n.icon}<span>${n.label}</span>
          ${n.id === 'followups' && overdueCount ? `<span class="bn-badge">${overdueCount > 9 ? '9+' : overdueCount}</span>` : ''}
        </button>`).join('')}
    </nav>
  `;
}

function openSidebar() {
  const sb = document.getElementById('sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  if (sb) sb.classList.add('open');
  if (scrim) scrim.classList.add('show');
}
function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  if (sb) sb.classList.remove('open');
  if (scrim) scrim.classList.remove('show');
}

/* ---------------------------- Small helpers ------------------------------- */
// Read a named field from a form without relying on form.<name> magic
// property access, which can collide with reserved HTMLFormElement props.
function fv(form, name) {
  const el = form.querySelector(`[name="${name}"]`);
  return el ? el.value : '';
}
function setFieldError(form, name, msg) {
  const input = form.querySelector(`[name="${name}"]`);
  const err = form.querySelector(`#err-${name}`);
  if (input) input.classList.add('input-error');
  if (err) { err.textContent = msg; err.style.display = 'block'; }
}
function clearFormErrors(form) {
  form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  form.querySelectorAll('.error-text').forEach(el => { el.style.display = 'none'; el.textContent = ''; });
}
function fieldInput({ label, name, type = 'text', value = '', required = false, placeholder = '', hint = '' }) {
  return `<div class="field">
    <label for="f-${name}">${escapeHtml(label)}${required ? ' *' : ''}</label>
    <input class="input" id="f-${name}" name="${name}" type="${type}" ${type === 'number' ? 'min="0" step="1"' : ''} value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
    ${hint ? `<div class="hint">${escapeHtml(hint)}</div>` : ''}
    <div class="error-text" id="err-${name}" style="display:none"></div>
  </div>`;
}
function selectField({ label, name, value, options }) {
  return `<div class="field">
    <label for="f-${name}">${escapeHtml(label)}</label>
    <select class="input" id="f-${name}" name="${name}">
      ${options.map(([v, l]) => `<option value="${escapeHtml(v)}" ${v === value ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('')}
    </select>
  </div>`;
}
function renderEmptyState({ icon, title, desc, actionLabel, actionFn }) {
  return `<div class="empty-state card card-pad">
    ${icon}
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(desc)}</p>
    ${actionFn ? `<button class="btn btn-primary" onclick="${actionFn}">${Icon.plus} ${escapeHtml(actionLabel)}</button>` : ''}
  </div>`;
}
function statusBadge(status) {
  const meta = STATUS_META[status] || STATUS_META['New'];
  return `<span class="badge" style="background:${meta.light};color:${meta.color}"><span class="badge-dot"></span>${escapeHtml(status)}</span>`;
}
function followupBg(dateStr) {
  if (isOverdue(dateStr)) return 'var(--danger-light)';
  if (isDueToday(dateStr)) return 'var(--warning-light)';
  return 'var(--info-light)';
}
function followupColor(dateStr) {
  if (isOverdue(dateStr)) return 'var(--danger-strong)';
  if (isDueToday(dateStr)) return 'var(--warning-strong)';
  return 'var(--info)';
}

/* --------------------------------- Toasts ---------------------------------- */
function showToast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  while (root.children.length >= 3) root.removeChild(root.firstElementChild);
  const id = uid();
  const iconMap = { success: Icon.checkCircle, error: Icon.alert, info: Icon.info };
  const div = document.createElement('div');
  div.className = `toast toast-${type}`;
  div.id = 't_' + id;
  div.setAttribute('role', 'status');
  div.innerHTML = `${iconMap[type] || iconMap.success}<div class="msg">${escapeHtml(message)}</div><button class="toast-close" aria-label="Dismiss notification" onclick="dismissToast('${id}')">${Icon.close}</button>`;
  root.appendChild(div);
  setTimeout(() => dismissToast(id), 4200);
}
function dismissToast(id) {
  const el = document.getElementById('t_' + id);
  if (!el) return;
  el.classList.add('leaving');
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
}

/* --------------------------------- Modals ----------------------------------- */
function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = html;
  document.body.style.overflow = 'hidden';
  const overlay = root.querySelector('.modal-overlay');
  if (overlay) overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
  const focusable = root.querySelector('input, select, textarea, button');
  if (focusable) setTimeout(() => focusable.focus(), 20);
  root.addEventListener('keydown', trapTabKey);
}
function closeModal() {
  const root = document.getElementById('modal-root');
  root.removeEventListener('keydown', trapTabKey);
  root.innerHTML = '';
  document.body.style.overflow = '';
}
function trapTabKey(e) {
  if (e.key !== 'Tab') return;
  const root = document.getElementById('modal-root');
  const items = Array.from(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(el => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const root = document.getElementById('modal-root');
    if (root && root.innerHTML.trim()) closeModal();
    return;
  }
  // Power-user shortcuts — only when not typing in a field and no modal is open.
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  const modalOpen = document.getElementById('modal-root').innerHTML.trim();
  if (modalOpen) return;

  if (e.key === '/') {
    const search = document.querySelector('.search-box input');
    if (search) { e.preventDefault(); search.focus(); }
  } else if (e.key.toLowerCase() === 'n') {
    e.preventDefault();
    openLeadFormModal();
  }
});

function openConfirm({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  window.__confirmAction = onConfirm;
  const html = `
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="modal modal-sm">
        <div class="modal-head">
          <div><h2 id="confirm-title">${escapeHtml(title)}</h2></div>
          <button class="modal-close" onclick="closeModal()" aria-label="Close">${Icon.close}</button>
        </div>
        <div class="modal-body"><p>${escapeHtml(message)}</p></div>
        <div class="modal-foot">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" onclick="__runConfirm()">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    </div>`;
  openModal(html);
}
function __runConfirm() {
  const fn = window.__confirmAction;
  closeModal();
  if (typeof fn === 'function') fn();
}

/* ============================== DATA HELPERS =============================== */
function getLead(id) { return state.leads.find(l => l.id === id); }
function getTemplate(id) { return state.templates.find(t => t.id === id); }

function addLead(lead) { state.leads.unshift(lead); persist(); }
function updateLead(id, patch) { const l = getLead(id); if (!l) return; Object.assign(l, patch); persist(); }
function deleteLead(id) { state.leads = state.leads.filter(l => l.id !== id); persist(); }

function computeKPIs() {
  const leads = state.leads;
  const total = leads.length;
  const dueToday = leads.filter(l => l.nextFollowUp && isDueToday(l.nextFollowUp)).length;
  const overdue = leads.filter(l => l.nextFollowUp && isOverdue(l.nextFollowUp)).length;
  const potential = leads.filter(l => l.status !== 'Lost').reduce((s, l) => s + (Number(l.value) || 0), 0);
  const won = leads.filter(l => l.status === 'Won').reduce((s, l) => s + (Number(l.value) || 0), 0);
  return { total, dueToday, overdue, potential, won };
}

/* ================================ DASHBOARD ================================ */
function renderDashboardPage() {
  const k = computeKPIs();
  const recent = state.leads.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  const overdueLeads = state.leads.filter(l => l.nextFollowUp && isOverdue(l.nextFollowUp));

  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">Welcome back${state.business.name ? ', ' + escapeHtml(state.business.name) : ''} — here's where things stand today.</p>
    </div>
    <button class="btn btn-primary" onclick="openLeadFormModal()">${Icon.plus} Add Lead</button>
  </div>

  ${overdueLeads.length ? `
  <div class="alert-banner">
    ${Icon.alert}
    <div><strong>${overdueLeads.length} follow-up${overdueLeads.length > 1 ? 's' : ''} overdue.</strong> <span class="text-muted">Don't keep them waiting too long.</span></div>
    <button class="btn btn-secondary btn-sm" onclick="navigateTo('followups')">Review now</button>
  </div>` : ''}

  <div class="kpi-grid">
    ${kpiCard({ icon: Icon.users, color: 'var(--info)', light: 'var(--info-light)', label: 'Total leads', raw: k.total, format: 'number' })}
    ${kpiCard({ icon: Icon.clock, color: 'var(--warning-strong)', light: 'var(--warning-light)', label: 'Due today', raw: k.dueToday, format: 'number' })}
    ${kpiCard({ icon: Icon.alert, color: 'var(--danger-strong)', light: 'var(--danger-light)', label: 'Overdue follow-ups', raw: k.overdue, format: 'number' })}
    ${kpiCard({ icon: Icon.wallet, color: 'var(--primary)', light: 'var(--primary-light)', label: 'Potential revenue', raw: k.potential, format: 'currency' })}
    ${kpiCard({ icon: Icon.trophy, color: 'var(--success)', light: 'var(--success-light)', label: 'Won revenue', raw: k.won, format: 'currency' })}
  </div>

  <div class="dashboard-grid">
    <div class="card card-pad">
      <div class="flex items-center justify-between mb-12">
        <div class="section-title" style="margin-bottom:0">Recent leads</div>
        <button class="btn btn-ghost btn-sm" onclick="navigateTo('leads')">View all ${Icon.arrowRight}</button>
      </div>
      ${recent.length ? recent.map(l => `
        <div class="recent-lead-row" tabindex="0" role="button" aria-label="View ${escapeHtml(l.name)}" onclick="openLeadDetailModal('${l.id}')" onkeydown="if(event.key==='Enter'){this.click();}">
          <div class="avatar">${escapeHtml(initials(l.name))}</div>
          <div class="recent-lead-info">
            <div class="name">${escapeHtml(l.name)}</div>
            <div class="meta">${escapeHtml(l.phone)} • ${escapeHtml(l.status)}</div>
          </div>
          <div class="recent-lead-value">${formatPKR(l.value)}</div>
        </div>`).join('') : renderEmptyState({ icon: Icon.illustrationLeads, title: 'No leads yet', desc: 'Add your first WhatsApp lead to get started.', actionLabel: 'Add Lead', actionFn: 'openLeadFormModal()' })}
    </div>

    <div class="card card-pad">
      <div class="section-title">Pipeline summary</div>
      ${renderPipelineSummary()}
    </div>
  </div>
  `;
}
function kpiCard({ icon, color, light, label, raw, format }) {
  const initial = format === 'currency' ? formatPKR(0) : '0';
  return `<div class="card kpi-card">
    <div class="kpi-icon" style="background:${light};color:${color}">${icon}</div>
    <div class="kpi-value" data-target="${raw}" data-format="${format}">${initial}</div>
    <div class="kpi-label">${label}</div>
  </div>`;
}
function animateKPIs() {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.kpi-value[data-target]').forEach(el => {
    const target = Number(el.dataset.target) || 0;
    const format = el.dataset.format;
    if (reduced || target === 0) { el.textContent = format === 'currency' ? formatPKR(target) : String(target); return; }
    const duration = 650;
    const start = performance.now();
    function step(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = Math.round(target * eased);
      el.textContent = format === 'currency' ? formatPKR(current) : String(current);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}
function renderPipelineSummary() {
  const counts = {};
  STATUSES.forEach(s => counts[s] = 0);
  state.leads.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
  const max = Math.max(1, ...Object.values(counts));
  return `<div class="pipeline-summary">${STATUSES.map(s => {
    const meta = STATUS_META[s];
    const pct = Math.round((counts[s] / max) * 100);
    return `<div class="pipeline-row">
      <span class="dot" style="background:${meta.color}"></span>
      <span class="label">${s}</span>
      <div class="pipeline-bar-track"><div class="pipeline-bar-fill" style="width:${pct}%;background:${meta.color}"></div></div>
      <span class="count">${counts[s]}</span>
    </div>`;
  }).join('')}</div>`;
}

/* ================================== LEADS =================================== */
function getFilteredLeads(forList) {
  let leads = state.leads.slice();
  const q = ui.leadsSearch.trim().toLowerCase();
  if (q) {
    leads = leads.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q) ||
      (l.business || '').toLowerCase().includes(q));
  }
  if (forList) {
    if (ui.leadsStatusFilter !== 'all') leads = leads.filter(l => l.status === ui.leadsStatusFilter);
    if (ui.leadsDateFrom) leads = leads.filter(l => l.nextFollowUp && l.nextFollowUp >= ui.leadsDateFrom);
    if (ui.leadsDateTo) leads = leads.filter(l => l.nextFollowUp && l.nextFollowUp <= ui.leadsDateTo);
    leads.sort(sortComparator(ui.leadsSort));
  } else {
    leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return leads;
}
function sortComparator(sort) {
  switch (sort) {
    case 'createdAsc': return (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
    case 'followupAsc': return (a, b) => (a.nextFollowUp || '9999-99-99').localeCompare(b.nextFollowUp || '9999-99-99');
    case 'valueDesc': return (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0);
    case 'valueAsc': return (a, b) => (Number(a.value) || 0) - (Number(b.value) || 0);
    default: return (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  }
}

function renderLeadsPage() {
  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Leads</h1>
      <p class="page-subtitle">Track every WhatsApp conversation from first message to sale.</p>
    </div>
    <button class="btn btn-primary" onclick="openLeadFormModal()">${Icon.plus} Add Lead</button>
  </div>
  <div class="toolbar">
    <div class="search-box">
      ${Icon.search}
      <input class="input" placeholder="Search name, phone, or business..." value="${escapeHtml(ui.leadsSearch)}" oninput="handleLeadsSearchInput(this.value)" aria-label="Search leads" />
    </div>
    <div class="view-switch" role="group" aria-label="Leads view">
      <button class="${ui.leadsView === 'kanban' ? 'active' : ''}" onclick="setLeadsView('kanban')" aria-pressed="${ui.leadsView === 'kanban'}">${Icon.kanban} Board</button>
      <button class="${ui.leadsView === 'list' ? 'active' : ''}" onclick="setLeadsView('list')" aria-pressed="${ui.leadsView === 'list'}">${Icon.list} List</button>
    </div>
    ${ui.leadsView === 'list' ? renderListFiltersInline() : ''}
  </div>
  <div id="leads-results">${ui.leadsView === 'kanban' ? renderKanbanBoard() : renderLeadsTable()}</div>
  `;
}

function renderListFiltersInline() {
  return `
  <select class="input" style="width:auto" onchange="setLeadsStatusFilter(this.value)" aria-label="Filter by status">
    <option value="all" ${ui.leadsStatusFilter === 'all' ? 'selected' : ''}>All statuses</option>
    ${STATUSES.map(s => `<option value="${s}" ${ui.leadsStatusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
  </select>
  <input class="input" style="width:auto" type="date" value="${ui.leadsDateFrom}" onchange="setLeadsDateFrom(this.value)" aria-label="Follow-up date from" title="Follow-up from" />
  <input class="input" style="width:auto" type="date" value="${ui.leadsDateTo}" onchange="setLeadsDateTo(this.value)" aria-label="Follow-up date to" title="Follow-up to" />
  <select class="input" style="width:auto" onchange="setLeadsSort(this.value)" aria-label="Sort leads">
    <option value="createdDesc" ${ui.leadsSort === 'createdDesc' ? 'selected' : ''}>Newest first</option>
    <option value="createdAsc" ${ui.leadsSort === 'createdAsc' ? 'selected' : ''}>Oldest first</option>
    <option value="followupAsc" ${ui.leadsSort === 'followupAsc' ? 'selected' : ''}>Follow-up date</option>
    <option value="valueDesc" ${ui.leadsSort === 'valueDesc' ? 'selected' : ''}>Highest value</option>
    <option value="valueAsc" ${ui.leadsSort === 'valueAsc' ? 'selected' : ''}>Lowest value</option>
  </select>`;
}

const debouncedLeadsSearch = debounce((val) => { ui.leadsSearch = val; ui.leadsPage = 1; refreshLeadsResults(); }, 150);
function handleLeadsSearchInput(val) { debouncedLeadsSearch(val); }
function refreshLeadsResults() {
  const el = document.getElementById('leads-results');
  if (el) el.innerHTML = ui.leadsView === 'kanban' ? renderKanbanBoard() : renderLeadsTable();
  if (ui.leadsView === 'kanban') attachKanbanDragHandlers();
}
function setLeadsView(v) { ui.leadsView = v; render(); }
function setLeadsStatusFilter(v) { ui.leadsStatusFilter = v; ui.leadsPage = 1; refreshLeadsResults(); }
function setLeadsDateFrom(v) { ui.leadsDateFrom = v; ui.leadsPage = 1; refreshLeadsResults(); }
function setLeadsDateTo(v) { ui.leadsDateTo = v; ui.leadsPage = 1; refreshLeadsResults(); }
function setLeadsSort(v) { ui.leadsSort = v; ui.leadsPage = 1; refreshLeadsResults(); }
function changeLeadsPage(delta) { ui.leadsPage = (ui.leadsPage || 1) + delta; refreshLeadsResults(); }

function renderKanbanBoard() {
  const leads = getFilteredLeads(false);
  if (!state.leads.length) {
    return renderEmptyState({ icon: Icon.illustrationLeads, title: 'No leads yet', desc: 'Add your first WhatsApp lead to start building your pipeline.', actionLabel: 'Add Lead', actionFn: 'openLeadFormModal()' });
  }
  return `<div class="kanban-scroll"><div class="kanban-board">
    ${STATUSES.map(status => {
      const colLeads = leads.filter(l => l.status === status);
      const meta = STATUS_META[status];
      return `<div class="kanban-col">
        <div class="kanban-col-head">
          <span class="dot" style="background:${meta.color}"></span>
          <span class="title">${status}</span>
          <span class="count">${colLeads.length}</span>
        </div>
        <div class="kanban-col-body" data-status="${status}">${colLeads.map(l => renderLeadCard(l)).join('')}</div>
      </div>`;
    }).join('')}
  </div></div>`;
}

function renderLeadCard(l) {
  const idx = STATUSES.indexOf(l.status);
  const canPrev = idx > 0;
  const canNext = idx < STATUSES.length - 1;
  return `<div class="lead-card" tabindex="0" role="button" aria-label="View ${escapeHtml(l.name)}" data-lead-id="${l.id}"
    onclick="handleCardClick('${l.id}')" onkeydown="if(event.key==='Enter'){this.click();}">
    <div class="lead-card-top">
      <div class="flex items-center gap-8">
        <span class="drag-handle" aria-label="Drag to move ${escapeHtml(l.name)} between stages" tabindex="-1">${Icon.drag}</span>
        <div>
          <div class="lead-card-name">${escapeHtml(l.name)}</div>
          <div class="lead-card-phone">${escapeHtml(l.phone)}</div>
        </div>
      </div>
      <div class="lead-card-value">${formatPKR(l.value)}</div>
    </div>
    ${l.nextFollowUp ? `<span class="lead-card-followup" style="background:${followupBg(l.nextFollowUp)};color:${followupColor(l.nextFollowUp)}">${Icon.calendar}${followUpRelativeLabel(l.nextFollowUp)}</span>` : ''}
    <div class="lead-card-actions" onclick="event.stopPropagation()">
      <button class="icon-btn" title="Move to previous stage" aria-label="Move to previous stage" ${!canPrev ? 'disabled' : ''} onclick="moveLeadStage('${l.id}', -1)">${Icon.arrowLeft}</button>
      <button class="icon-btn" title="Edit lead" aria-label="Edit lead" onclick="openLeadFormModal('${l.id}')">${Icon.edit}</button>
      <button class="icon-btn danger" title="Delete lead" aria-label="Delete lead" onclick="confirmDeleteLead('${l.id}')">${Icon.trash}</button>
      <button class="icon-btn" title="Move to next stage" aria-label="Move to next stage" ${!canNext ? 'disabled' : ''} onclick="moveLeadStage('${l.id}', 1)">${Icon.arrowRight}</button>
    </div>
  </div>`;
}

function renderLeadsTable() {
  const allLeads = getFilteredLeads(true);
  if (!allLeads.length) {
    return renderEmptyState({
      icon: state.leads.length ? Icon.illustrationSearch : Icon.illustrationLeads,
      title: state.leads.length ? 'No matching leads' : 'No leads found',
      desc: state.leads.length ? 'Try adjusting your search or filters.' : 'Add your first WhatsApp lead to get started.',
      actionLabel: 'Add Lead', actionFn: 'openLeadFormModal()',
    });
  }
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(allLeads.length / PAGE_SIZE));
  if (ui.leadsPage > totalPages) ui.leadsPage = totalPages;
  if (ui.leadsPage < 1) ui.leadsPage = 1;
  const start = (ui.leadsPage - 1) * PAGE_SIZE;
  const pageLeads = allLeads.slice(start, start + PAGE_SIZE);

  return `<div class="card table-wrap"><table class="data-table">
    <thead><tr>
      <th>Name</th><th>Phone</th><th>Business</th><th>Value</th><th>Status</th><th>Next follow-up</th><th></th>
    </tr></thead>
    <tbody>
      ${pageLeads.map(l => `<tr onclick="openLeadDetailModal('${l.id}')" tabindex="0" onkeydown="if(event.key==='Enter'){this.click();}">
        <td><strong>${escapeHtml(l.name)}</strong></td>
        <td>${escapeHtml(l.phone)}</td>
        <td>${l.business ? escapeHtml(l.business) : '<span class="text-faint">—</span>'}</td>
        <td>${formatPKR(l.value)}</td>
        <td>${statusBadge(l.status)}</td>
        <td>${l.nextFollowUp ? escapeHtml(followUpRelativeLabel(l.nextFollowUp)) : '<span class="text-faint">—</span>'}</td>
        <td onclick="event.stopPropagation()">
          <div class="row-actions">
            <button class="icon-btn" aria-label="Edit lead" onclick="openLeadFormModal('${l.id}')">${Icon.edit}</button>
            <button class="icon-btn danger" aria-label="Delete lead" onclick="confirmDeleteLead('${l.id}')">${Icon.trash}</button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>
  ${totalPages > 1 ? `<div class="pagination">
    <button class="btn btn-secondary btn-sm" ${ui.leadsPage <= 1 ? 'disabled' : ''} onclick="changeLeadsPage(-1)">${Icon.arrowLeft} Prev</button>
    <span class="page-info">Page ${ui.leadsPage} of ${totalPages} • ${allLeads.length} leads</span>
    <button class="btn btn-secondary btn-sm" ${ui.leadsPage >= totalPages ? 'disabled' : ''} onclick="changeLeadsPage(1)">Next ${Icon.arrowRight}</button>
  </div>` : ''}`;
}

/* ---- Kanban drag & drop ----
   Implemented with the Pointer Events API rather than HTML5 Drag & Drop so the
   exact same code path handles mouse, touch, and pen — HTML5 DnD has no touch
   support at all. Drag is initiated only from the grip handle (not the whole
   card), which keeps tap-to-open, vertical scroll, and drag fully unambiguous
   on touch devices without needing gesture/timing heuristics. */
let dragState = null;
let justDraggedCard = false;

function handleCardClick(id) {
  if (justDraggedCard) { justDraggedCard = false; return; }
  openLeadDetailModal(id);
}

function attachKanbanDragHandlers() {
  document.querySelectorAll('.kanban-col-body .drag-handle').forEach(handle => {
    handle.onpointerdown = onCardDragStart;
  });
}

function onCardDragStart(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return; // left click only
  const card = e.currentTarget.closest('.lead-card');
  if (!card) return;
  e.preventDefault();

  const rect = card.getBoundingClientRect();
  dragState = {
    leadId: card.dataset.leadId,
    card,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    width: rect.width,
    moved: false,
    ghost: null,
    lastColBody: null,
  };

  document.addEventListener('pointermove', onCardDragMove);
  document.addEventListener('pointerup', onCardDragEnd);
  document.addEventListener('pointercancel', onCardDragEnd);
}

function beginActualDrag() {
  const { card, width } = dragState;
  const rect = card.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = width + 'px';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  document.body.appendChild(ghost);
  card.classList.add('drag-source-hidden');
  dragState.ghost = ghost;
  dragState.moved = true;
}

function onCardDragMove(e) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;

  if (!dragState.moved) {
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return; // ignore tiny jitters/taps
    beginActualDrag();
  }

  const { ghost, offsetX, offsetY } = dragState;
  ghost.style.left = (e.clientX - offsetX) + 'px';
  ghost.style.top = (e.clientY - offsetY) + 'px';

  ghost.style.visibility = 'hidden';
  const target = document.elementFromPoint(e.clientX, e.clientY);
  ghost.style.visibility = '';
  const colBody = target ? target.closest('.kanban-col-body') : null;

  if (dragState.lastColBody !== colBody) {
    if (dragState.lastColBody) dragState.lastColBody.classList.remove('drag-over');
    if (colBody) colBody.classList.add('drag-over');
    dragState.lastColBody = colBody;
  }

  autoScrollKanban(e.clientX);
}

function autoScrollKanban(clientX) {
  const scrollEl = document.querySelector('.kanban-scroll');
  if (!scrollEl) return;
  const rect = scrollEl.getBoundingClientRect();
  const edge = 56;
  if (clientX < rect.left + edge) scrollEl.scrollLeft -= 14;
  else if (clientX > rect.right - edge) scrollEl.scrollLeft += 14;
}

function onCardDragEnd(e) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  document.removeEventListener('pointermove', onCardDragMove);
  document.removeEventListener('pointerup', onCardDragEnd);
  document.removeEventListener('pointercancel', onCardDragEnd);

  const { card, ghost, lastColBody, leadId, moved } = dragState;
  if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
  card.classList.remove('drag-source-hidden');
  if (lastColBody) lastColBody.classList.remove('drag-over');
  dragState = null;

  if (!moved) return; // simple tap on the handle — let the card's own click handle it

  justDraggedCard = true;
  setTimeout(() => { justDraggedCard = false; }, 300); // safety net if no click follows (e.g. touch)

  if (lastColBody) {
    const status = lastColBody.dataset.status;
    const l = getLead(leadId);
    if (l && status && l.status !== status) {
      updateLead(leadId, { status });
      showToast(`Moved ${l.name} to ${status}.`, 'success');
      if (status === 'Won') celebrateWin();
      refreshLeadsResults();
      return;
    }
  }
}

function moveLeadStage(id, delta) {
  const l = getLead(id);
  if (!l) return;
  const idx = STATUSES.indexOf(l.status);
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= STATUSES.length) return;
  updateLead(id, { status: STATUSES[newIdx] });
  showToast(`Moved ${l.name} to ${STATUSES[newIdx]}.`, 'success');
  render();
}

function confirmDeleteLead(id) {
  const l = getLead(id);
  if (!l) return;
  openConfirm({
    title: 'Delete lead?',
    message: `This will permanently remove ${l.name} and all their details. This can't be undone.`,
    confirmLabel: 'Delete lead',
    danger: true,
    onConfirm: () => { deleteLead(id); showToast('Lead deleted.', 'success'); render(); },
  });
}

/* ---- Add / Edit lead modal ---- */
function openLeadFormModal(id) {
  const lead = id ? getLead(id) : null;
  const html = `
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="lead-form-title">
    <div class="modal modal-lg">
      <div class="modal-head">
        <div>
          <h2 id="lead-form-title">${lead ? 'Edit Lead' : 'Add New Lead'}</h2>
          <p>${lead ? "Update this customer's details." : 'Capture a new WhatsApp lead.'}</p>
        </div>
        <button class="modal-close" onclick="closeModal()" aria-label="Close">${Icon.close}</button>
      </div>
      <form id="lead-form" onsubmit="return handleLeadFormSubmit(event, ${lead ? `'${lead.id}'` : 'null'})" novalidate>
        <div class="modal-body">
          <div class="field-row">
            ${fieldInput({ label: 'Customer name', name: 'name', value: lead ? lead.name : '', required: true, placeholder: 'e.g. Ayesha Khan' })}
            ${fieldInput({ label: 'Phone number', name: 'phone', value: lead ? lead.phone : '', required: true, placeholder: 'e.g. 0301-2345678', hint: '+92 or 03 formats are fine.' })}
          </div>
          <div class="field-row">
            ${fieldInput({ label: 'Business / Service', name: 'business', value: lead ? lead.business : '', placeholder: 'Optional' })}
            <div class="field">
              <label for="f-value">Lead value (PKR)</label>
              <input class="input" id="f-value" name="value" type="number" min="0" step="1" value="${escapeHtml(lead ? lead.value : '')}" placeholder="0" oninput="updateValuePreview(this.value)" />
              <div class="hint" id="value-preview">${lead && lead.value ? '= ' + formatPKR(lead.value) : ''}</div>
              <div class="error-text" id="err-value" style="display:none"></div>
            </div>
          </div>
          ${fieldInput({ label: 'Product / Service details', name: 'productService', value: lead ? lead.productService : '', placeholder: 'What are they interested in?' })}
          <div class="field-row">
            ${selectField({ label: 'Source', name: 'source', value: lead ? lead.source : 'WhatsApp', options: SOURCES.map(s => [s, s]) })}
            ${selectField({ label: 'Status', name: 'status', value: lead ? lead.status : 'New', options: STATUSES.map(s => [s, s]) })}
          </div>
          ${fieldInput({ label: 'Next follow-up date', name: 'nextFollowUp', type: 'date', value: lead && lead.nextFollowUp ? lead.nextFollowUp : '' })}
          <div class="field">
            <label for="f-notes">Notes</label>
            <textarea class="input" id="f-notes" name="notes" rows="3" placeholder="Anything worth remembering about this customer...">${escapeHtml(lead ? lead.notes : '')}</textarea>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${lead ? 'Save changes' : 'Add lead'}</button>
        </div>
      </form>
    </div>
  </div>`;
  openModal(html);
}

function updateValuePreview(val) {
  const el = document.getElementById('value-preview');
  if (!el) return;
  const n = Number(val);
  el.textContent = (val !== '' && !isNaN(n) && n >= 0) ? '= ' + formatPKR(n) : '';
}

function handleLeadFormSubmit(e, id) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);

  const name = sanitizeText(fv(form, 'name'));
  const phone = sanitizeText(fv(form, 'phone'));
  const business = sanitizeText(fv(form, 'business'));
  const productService = sanitizeText(fv(form, 'productService'));
  const valueRaw = fv(form, 'value');
  const source = fv(form, 'source');
  const notes = sanitizeText(fv(form, 'notes'));
  const status = fv(form, 'status');
  const nextFollowUp = fv(form, 'nextFollowUp') || null;

  let hasError = false;
  if (!name) { setFieldError(form, 'name', 'Name is required.'); hasError = true; }
  if (!phone) { setFieldError(form, 'phone', 'Phone number is required.'); hasError = true; }
  else if (!isValidPakPhone(phone)) { setFieldError(form, 'phone', 'Enter a valid phone number, e.g. 0301-2345678 or +923012345678.'); hasError = true; }

  let value = 0;
  if (valueRaw !== '') {
    value = Number(valueRaw);
    if (isNaN(value) || value < 0) { setFieldError(form, 'value', 'Value must be zero or a positive number.'); hasError = true; }
  }

  if (hasError) return false;

  if (id) {
    updateLead(id, { name, phone, business, productService, value, source, notes, status, nextFollowUp });
    showToast('Lead updated successfully.', 'success');
  } else {
    addLead({ id: uid(), name, phone, business, productService, value, source, notes, status, createdAt: new Date().toISOString(), nextFollowUp, lastCompletedAt: null });
    showToast('Lead added successfully.', 'success');
  }
  closeModal();
  render();
  return false;
}

/* ---- Lead detail modal ---- */
function openLeadDetailModal(id) {
  const lead = getLead(id);
  if (!lead) return;
  openModal(renderLeadDetailHTML(lead));
}
function refreshOpenLeadDetail(id) {
  const root = document.getElementById('modal-root');
  if (root && root.querySelector('#detail-title')) {
    const l = getLead(id);
    if (l) root.innerHTML = renderLeadDetailHTML(l);
  }
}
function renderLeadDetailHTML(lead) {
  return `<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="detail-title">
    <div class="modal modal-lg">
      <div class="modal-head">
        <div>
          <h2 id="detail-title">${escapeHtml(lead.name)}</h2>
          <p>Added ${formatDateTimePretty(lead.createdAt)} &nbsp;•&nbsp; ${statusBadge(lead.status)}</p>
        </div>
        <button class="modal-close" onclick="closeModal()" aria-label="Close">${Icon.close}</button>
      </div>
      <div class="modal-body">
        <div class="detail-grid">
          <div class="detail-item"><div class="k">Phone</div><div class="v">${escapeHtml(lead.phone)}</div></div>
          <div class="detail-item"><div class="k">Business / Service</div><div class="v">${lead.business ? escapeHtml(lead.business) : '—'}</div></div>
          <div class="detail-item"><div class="k">Lead value</div><div class="v">${formatPKR(lead.value)}</div></div>
          <div class="detail-item"><div class="k">Source</div><div class="v">${escapeHtml(lead.source)}</div></div>
        </div>
        <div class="detail-item mt-16"><div class="k">Product / Service</div><div class="v">${lead.productService ? escapeHtml(lead.productService) : '—'}</div></div>
        <div class="detail-divider"></div>
        <div class="section-title">Notes</div>
        <div class="notes-box">${lead.notes ? escapeHtml(lead.notes) : 'No notes yet.'}</div>
        <div class="detail-divider"></div>
        <div class="section-title">Follow-up timeline</div>
        ${renderFollowupTimeline(lead)}
        <div class="detail-divider"></div>
        <div id="reply-panel-slot"></div>
      </div>
      <div class="modal-foot split">
        <div class="flex gap-8" style="flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="openLeadFormModal('${lead.id}')">${Icon.edit} Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="confirmDeleteLead('${lead.id}')">${Icon.trash} Delete</button>
        </div>
        <div class="flex gap-8" style="flex-wrap:wrap;justify-content:flex-end">
          ${lead.status === 'New' ? `<button class="btn btn-secondary btn-sm" onclick="markContacted('${lead.id}')">${Icon.check} Mark contacted</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="openScheduleFollowup('${lead.id}')">${Icon.calendar} Schedule follow-up</button>
          <button class="btn btn-whatsapp btn-sm" onclick="openReplyPanel('${lead.id}')">${Icon.whatsapp} Copy reply</button>
          ${lead.status !== 'Won' ? `<button class="btn btn-primary btn-sm" onclick="confirmMarkStatus('${lead.id}','Won')">${Icon.trophy} Mark Won</button>` : ''}
          ${lead.status !== 'Lost' ? `<button class="btn btn-danger btn-sm" onclick="confirmMarkStatus('${lead.id}','Lost')">Mark Lost</button>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}
function renderFollowupTimeline(lead) {
  const items = [];
  items.push({ label: 'Lead captured', date: formatDateTimePretty(lead.createdAt), color: 'var(--info)' });
  if (lead.nextFollowUp) {
    const overdue = isOverdue(lead.nextFollowUp);
    items.push({ label: overdue ? 'Follow-up overdue' : 'Next follow-up scheduled', date: formatDatePretty(lead.nextFollowUp), color: overdue ? 'var(--danger-strong)' : 'var(--warning-strong)' });
  } else if (lead.status !== 'Won' && lead.status !== 'Lost') {
    items.push({ label: 'No follow-up scheduled', date: 'Set a date to stay on track', color: 'var(--text-faint)' });
  }
  if (lead.lastCompletedAt) items.push({ label: 'Follow-up completed', date: formatDateTimePretty(lead.lastCompletedAt), color: 'var(--success)' });
  if (lead.status === 'Won') items.push({ label: 'Marked as Won 🎉', date: 'Deal closed', color: 'var(--success)' });
  if (lead.status === 'Lost') items.push({ label: 'Marked as Lost', date: 'Deal closed', color: 'var(--danger-strong)' });
  return `<div class="timeline">${items.map(i => `<div class="timeline-item"><span class="timeline-dot" style="background:${i.color}"></span><div><div class="t-label">${escapeHtml(i.label)}</div><div class="t-date">${escapeHtml(i.date)}</div></div></div>`).join('')}</div>`;
}

function markContacted(id) {
  const l = getLead(id);
  if (!l) return;
  if (l.status === 'New') {
    updateLead(id, { status: 'Replied' });
    showToast(`${l.name} marked as contacted.`, 'success');
  }
  render();
  refreshOpenLeadDetail(id);
}

function openScheduleFollowup(id) {
  const lead = getLead(id);
  if (!lead) return;
  const html = `<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sched-title">
    <div class="modal modal-sm">
      <div class="modal-head">
        <div><h2 id="sched-title">Schedule follow-up</h2><p>${escapeHtml(lead.name)}</p></div>
        <button class="modal-close" onclick="closeModal()" aria-label="Close">${Icon.close}</button>
      </div>
      <form onsubmit="return handleScheduleFollowup(event,'${lead.id}')" novalidate>
        <div class="modal-body">
          ${fieldInput({ label: 'Follow-up date', name: 'followupDate', type: 'date', value: lead.nextFollowUp || todayStr(), required: true })}
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  </div>`;
  openModal(html);
}
function handleScheduleFollowup(e, id) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);
  const val = fv(form, 'followupDate');
  if (!val) { setFieldError(form, 'followupDate', 'Please choose a date.'); return false; }
  const l = getLead(id);
  updateLead(id, { nextFollowUp: val });
  showToast(`Follow-up scheduled for ${l ? l.name : 'lead'}.`, 'success');
  closeModal();
  render();
  return false;
}

function confirmMarkStatus(id, status) {
  const l = getLead(id);
  if (!l) return;
  openConfirm({
    title: status === 'Won' ? 'Mark as Won?' : 'Mark as Lost?',
    message: status === 'Won'
      ? `Great news! Mark ${l.name} as a won deal worth ${formatPKR(l.value)}?`
      : `Mark ${l.name} as lost? You'll still be able to find them later in the Lost column.`,
    confirmLabel: status === 'Won' ? 'Mark Won' : 'Mark Lost',
    danger: status === 'Lost',
    onConfirm: () => {
      updateLead(id, { status });
      showToast(`${l.name} marked as ${status}.`, 'success');
      if (status === 'Won') celebrateWin();
      render();
    },
  });
}

function celebrateWin() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#0E7C66', '#25D366', '#F0AC4E', '#7439C9', '#2354C9'];
  const container = document.createElement('div');
  container.className = 'confetti-container';
  for (let i = 0; i < 28; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = (Math.random() * 0.3) + 's';
    piece.style.transform = `rotate(${Math.round(Math.random() * 360)}deg)`;
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => { if (container.parentNode) container.parentNode.removeChild(container); }, 2000);
}

/* ---- Copy WhatsApp reply panel (inline within lead detail) ---- */
function replyVarsForLead(lead) {
  return {
    name: lead.name,
    product: lead.productService || 'your order',
    price: lead.value ? Math.round(lead.value).toLocaleString('en-PK') : '—',
    business_name: state.business.name || 'us',
  };
}
function openReplyPanel(id) {
  const slot = document.getElementById('reply-panel-slot');
  const lead = getLead(id);
  if (!slot || !lead) return;
  const suggested = STATUS_TO_TEMPLATE_CATEGORIES[lead.status] || [];
  const templates = state.templates.slice().sort((a, b) => {
    const aScore = suggested.indexOf(a.category) === -1 ? 99 : suggested.indexOf(a.category);
    const bScore = suggested.indexOf(b.category) === -1 ? 99 : suggested.indexOf(b.category);
    if (aScore !== bScore) return aScore - bScore;
    return (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
  });
  const vars = replyVarsForLead(lead);
  slot.innerHTML = `<div class="reply-panel">
    <div class="flex items-center justify-between">
      <div class="section-title" style="margin-bottom:0">Suggested WhatsApp replies</div>
      <button class="icon-btn" aria-label="Close reply panel" onclick="document.getElementById('reply-panel-slot').innerHTML=''">${Icon.close}</button>
    </div>
    <div class="reply-panel-list">
      ${templates.slice(0, 8).map(t => `
        <div class="reply-option">
          <div class="title-row"><strong>${escapeHtml(t.title)}</strong><span class="badge" style="background:var(--bg-subtle);color:var(--text-muted)">${t.language === 'ur' ? 'Roman Urdu' : 'English'}</span></div>
          <div class="body-text">${escapeHtml(fillTemplate(t.body, vars))}</div>
          <button class="btn btn-whatsapp btn-sm" onclick="copyReplyText('${t.id}','${lead.id}')">${Icon.copy} Copy</button>
        </div>`).join('')}
    </div>
  </div>`;
}
function copyReplyText(templateId, leadId) {
  const t = getTemplate(templateId);
  const lead = getLead(leadId);
  if (!t) return;
  const vars = lead ? replyVarsForLead(lead) : { business_name: state.business.name || 'us' };
  const text = fillTemplate(t.body, vars);
  copyText(text).then(ok => showToast(ok ? 'Reply copied to clipboard.' : 'Could not copy — please copy manually.', ok ? 'success' : 'error'));
}

/* ================================ TEMPLATES ================================= */
function getFilteredTemplates() {
  let list = state.templates.slice();
  const f = ui.templatesFilter;
  if (f.search) { const q = f.search.toLowerCase(); list = list.filter(t => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)); }
  if (f.category !== 'all') list = list.filter(t => t.category === f.category);
  if (f.language !== 'all') list = list.filter(t => t.language === f.language);
  if (f.favOnly) list = list.filter(t => t.isFavorite);
  list.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0) || a.title.localeCompare(b.title));
  return list;
}

function renderTemplatesPage() {
  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Reply Templates</h1>
      <p class="page-subtitle">Ready-made English &amp; Roman Urdu replies for common WhatsApp conversations.</p>
    </div>
    <button class="btn btn-primary" onclick="openTemplateFormModal()">${Icon.plus} New Template</button>
  </div>

  <div class="card card-pad mb-16">
    <div class="section-title">Preview with a sample lead</div>
    <p class="text-sm text-muted mb-8">Pick a lead to see how {{name}}, {{product}}, {{price}} and {{business_name}} are filled in below.</p>
    <select class="input" style="max-width:320px" onchange="setPreviewLead(this.value)" aria-label="Preview with lead">
      <option value="">No lead selected — show raw placeholders</option>
      ${state.leads.map(l => `<option value="${l.id}" ${ui.previewLeadId === l.id ? 'selected' : ''}>${escapeHtml(l.name)} — ${escapeHtml(l.phone)}</option>`).join('')}
    </select>
  </div>

  <div class="toolbar">
    <div class="search-box">
      ${Icon.search}
      <input class="input" placeholder="Search templates..." value="${escapeHtml(ui.templatesFilter.search)}" oninput="handleTemplatesSearchInput(this.value)" aria-label="Search templates" />
    </div>
    <select class="input" style="width:auto" onchange="setTemplatesFilter('category', this.value)" aria-label="Filter by category">
      <option value="all">All categories</option>
      ${TEMPLATE_CATEGORIES.map(c => `<option value="${c.id}" ${ui.templatesFilter.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
    </select>
    <select class="input" style="width:auto" onchange="setTemplatesFilter('language', this.value)" aria-label="Filter by language">
      <option value="all">All languages</option>
      <option value="en" ${ui.templatesFilter.language === 'en' ? 'selected' : ''}>English</option>
      <option value="ur" ${ui.templatesFilter.language === 'ur' ? 'selected' : ''}>Roman Urdu</option>
    </select>
    <button class="btn ${ui.templatesFilter.favOnly ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="toggleFavOnly()" aria-pressed="${ui.templatesFilter.favOnly}">${Icon.star} Favorites</button>
  </div>
  <div id="templates-results">${renderTemplatesGrid()}</div>
  `;
}

function renderTemplatesGrid() {
  const list = getFilteredTemplates();
  if (!list.length) {
    return renderEmptyState({ icon: Icon.illustrationTemplates, title: 'No templates found', desc: 'Try a different search or filter, or create a new template.', actionLabel: 'New Template', actionFn: 'openTemplateFormModal()' });
  }
  const previewLead = ui.previewLeadId ? getLead(ui.previewLeadId) : null;
  const vars = previewLead
    ? replyVarsForLead(previewLead)
    : { name: '{{name}}', product: '{{product}}', price: '{{price}}', business_name: state.business.name || '{{business_name}}' };
  return `<div class="template-grid">${list.map(t => renderTemplateCard(t, vars)).join('')}</div>`;
}
function renderTemplateCard(t, vars) {
  const bodyPreview = fillTemplate(t.body, vars);
  return `<div class="card template-card">
    <div class="template-card-head">
      <div>
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="template-tags mt-8">
          <span class="badge" style="background:var(--bg-subtle);color:var(--text-muted)">${escapeHtml(categoryLabel(t.category))}</span>
          <span class="badge" style="background:var(--bg-subtle);color:var(--text-muted)">${t.language === 'ur' ? 'Roman Urdu' : 'English'}</span>
        </div>
      </div>
      <button class="star-btn ${t.isFavorite ? 'active' : ''}" aria-label="${t.isFavorite ? 'Remove from favorites' : 'Add to favorites'}" onclick="toggleTemplateFavorite('${t.id}')">${Icon.star}</button>
    </div>
    <div class="template-body">${escapeHtml(bodyPreview)}</div>
    <div class="template-card-foot">
      <button class="btn btn-whatsapp btn-sm" onclick="copyTemplateText('${t.id}')">${Icon.copy} Copy</button>
      <button class="btn btn-secondary btn-sm" aria-label="Edit template" onclick="openTemplateFormModal('${t.id}')">${Icon.edit}</button>
      <button class="btn btn-secondary btn-sm" aria-label="Delete template" onclick="confirmDeleteTemplate('${t.id}')">${Icon.trash}</button>
    </div>
  </div>`;
}

const debouncedTemplatesSearch = debounce((val) => {
  ui.templatesFilter.search = val;
  const el = document.getElementById('templates-results');
  if (el) el.innerHTML = renderTemplatesGrid();
}, 150);
function handleTemplatesSearchInput(val) { debouncedTemplatesSearch(val); }
function setTemplatesFilter(key, val) { ui.templatesFilter[key] = val; render(); }
function toggleFavOnly() { ui.templatesFilter.favOnly = !ui.templatesFilter.favOnly; render(); }
function setPreviewLead(id) { ui.previewLeadId = id || null; render(); }
function toggleTemplateFavorite(id) {
  const t = getTemplate(id);
  if (!t) return;
  t.isFavorite = !t.isFavorite;
  persist();
  render();
}
function confirmDeleteTemplate(id) {
  const t = getTemplate(id);
  if (!t) return;
  openConfirm({
    title: 'Delete template?',
    message: `Delete "${t.title}"? This can't be undone.`,
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: () => { state.templates = state.templates.filter(x => x.id !== id); persist(); showToast('Template deleted.', 'success'); render(); },
  });
}
function copyTemplateText(id) {
  const t = getTemplate(id);
  if (!t) return;
  const previewLead = ui.previewLeadId ? getLead(ui.previewLeadId) : null;
  const vars = previewLead ? replyVarsForLead(previewLead) : { business_name: state.business.name || 'us' };
  const text = fillTemplate(t.body, vars);
  copyText(text).then(ok => showToast(ok ? 'Template copied to clipboard.' : 'Could not copy — please copy manually.', ok ? 'success' : 'error'));
}

function openTemplateFormModal(id) {
  const t = id ? getTemplate(id) : null;
  const html = `<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tpl-form-title">
    <div class="modal modal-lg">
      <div class="modal-head">
        <div><h2 id="tpl-form-title">${t ? 'Edit Template' : 'New Template'}</h2><p>Use {{name}}, {{product}}, {{price}}, {{business_name}} as placeholders.</p></div>
        <button class="modal-close" onclick="closeModal()" aria-label="Close">${Icon.close}</button>
      </div>
      <form onsubmit="return handleTemplateFormSubmit(event, ${t ? `'${t.id}'` : 'null'})" novalidate>
        <div class="modal-body">
          ${fieldInput({ label: 'Title', name: 'title', value: t ? t.title : '', required: true, placeholder: 'e.g. Welcome message' })}
          <div class="field-row">
            ${selectField({ label: 'Category', name: 'category', value: t ? t.category : 'welcome', options: TEMPLATE_CATEGORIES.map(c => [c.id, c.label]) })}
            ${selectField({ label: 'Language', name: 'language', value: t ? t.language : 'en', options: [['en', 'English'], ['ur', 'Roman Urdu']] })}
          </div>
          <div class="field">
            <label for="f-body">Message</label>
            <textarea class="input" id="f-body" name="body" rows="5" placeholder="Type your reply, use {{name}} etc. for placeholders">${escapeHtml(t ? t.body : '')}</textarea>
            <div class="error-text" id="err-body" style="display:none"></div>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${t ? 'Save changes' : 'Create template'}</button>
        </div>
      </form>
    </div>
  </div>`;
  openModal(html);
}
function handleTemplateFormSubmit(e, id) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);
  const title = sanitizeText(fv(form, 'title'));
  const category = fv(form, 'category');
  const language = fv(form, 'language');
  const body = sanitizeText(fv(form, 'body'));

  let hasError = false;
  if (!title) { setFieldError(form, 'title', 'Title is required.'); hasError = true; }
  if (!body) { setFieldError(form, 'body', 'Message body is required.'); hasError = true; }
  if (hasError) return false;

  if (id) {
    const t = getTemplate(id);
    Object.assign(t, { title, category, language, body });
    showToast('Template updated.', 'success');
  } else {
    state.templates.unshift({ id: uid(), title, category, language, body, isFavorite: false });
    showToast('Template created.', 'success');
  }
  persist();
  closeModal();
  render();
  return false;
}

/* ================================ FOLLOW-UPS ================================= */
function getFollowupBuckets() {
  const leads = state.leads;
  const overdue = leads.filter(l => l.nextFollowUp && isOverdue(l.nextFollowUp)).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp));
  const today = leads.filter(l => l.nextFollowUp && isDueToday(l.nextFollowUp));
  const upcoming = leads.filter(l => l.nextFollowUp && isUpcomingWithin(l.nextFollowUp, 7)).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp));
  const completed = leads.filter(l => l.lastCompletedAt && (Date.now() - new Date(l.lastCompletedAt).getTime()) <= 7 * 86400000)
    .sort((a, b) => new Date(b.lastCompletedAt) - new Date(a.lastCompletedAt));
  return { overdue, today, upcoming, completed };
}
function markFollowupDone(id) {
  const l = getLead(id);
  if (!l) return;
  updateLead(id, { nextFollowUp: null, lastCompletedAt: new Date().toISOString() });
  showToast(`Follow-up with ${l.name} marked as done.`, 'success');
  render();
}
function setFollowupsTab(id) { ui.followupsTab = id; render(); }

function renderFollowupsPage() {
  const buckets = getFollowupBuckets();
  const tabs = [
    { id: 'overdue', label: 'Overdue', list: buckets.overdue },
    { id: 'today', label: 'Today', list: buckets.today },
    { id: 'upcoming', label: 'Upcoming', list: buckets.upcoming },
    { id: 'completed', label: 'Completed', list: buckets.completed },
  ];
  const active = tabs.find(t => t.id === ui.followupsTab) || tabs[0];
  return `
  <div class="page-header"><div><h1 class="page-title">Follow-ups</h1><p class="page-subtitle">Stay on top of every promise you made on WhatsApp.</p></div></div>
  <div class="tabs" role="tablist">
    ${tabs.map(t => `<button class="tab-btn ${t.id === active.id ? 'active' : ''}" role="tab" aria-selected="${t.id === active.id}" onclick="setFollowupsTab('${t.id}')">${t.label} <span class="count-chip">${t.list.length}</span></button>`).join('')}
  </div>
  <div class="card">${renderFollowupList(active)}</div>
  `;
}
function renderFollowupList(tab) {
  if (!tab.list.length) {
    const emptyCopy = {
      overdue: ['All caught up!', 'No overdue follow-ups. Great job staying on top of things.'],
      today: ['Nothing due today', 'No follow-ups are scheduled for today.'],
      upcoming: ['Nothing coming up', 'No follow-ups scheduled in the next 7 days.'],
      completed: ['No completed follow-ups yet', "Follow-ups you mark as done will show up here for 7 days."],
    }[tab.id];
    return `<div class="empty-state">${Icon.illustrationCheck}<h3>${emptyCopy[0]}</h3><p>${emptyCopy[1]}</p></div>`;
  }
  return tab.list.map(l => `
    <div class="followup-row">
      <div class="followup-info">
        <div class="name">${escapeHtml(l.name)}</div>
        <div class="meta">${escapeHtml(l.phone)}${l.business ? ' • ' + escapeHtml(l.business) : ''}</div>
      </div>
      ${tab.id === 'completed'
        ? `<span class="followup-date-chip" style="background:var(--success-light);color:var(--success)">Done ${formatDateTimePretty(l.lastCompletedAt)}</span>`
        : `<span class="followup-date-chip" style="background:${followupBg(l.nextFollowUp)};color:${followupColor(l.nextFollowUp)}">${escapeHtml(followUpRelativeLabel(l.nextFollowUp))} • ${formatDatePretty(l.nextFollowUp)}</span>`}
      <div class="followup-actions">
        ${tab.id !== 'completed' ? `
          <button class="btn btn-primary btn-sm" onclick="markFollowupDone('${l.id}')">${Icon.check} Mark done</button>
          <button class="btn btn-secondary btn-sm" onclick="openScheduleFollowup('${l.id}')">${Icon.calendar} Reschedule</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="openLeadDetailModal('${l.id}')">View</button>
      </div>
    </div>`).join('');
}

/* ================================= SETTINGS =================================== */
function renderSettingsPage() {
  const theme = state.settings.theme;
  return `
  <div class="page-header"><div><h1 class="page-title">Settings</h1><p class="page-subtitle">Configure your business profile, data, and appearance.</p></div></div>
  <div class="settings-grid">
    <div class="flex-col gap-12">
      <div class="card card-pad">
        <div class="section-title">Business profile</div>
        <form onsubmit="return handleBusinessFormSubmit(event)" novalidate>
          ${fieldInput({ label: 'Business name', name: 'businessName', value: state.business.name, placeholder: 'e.g. StyleCart PK', hint: 'Used as {{business_name}} in templates.' })}
          ${selectField({ label: 'Default template language', name: 'defaultLanguage', value: state.business.defaultLanguage, options: [['en', 'English'], ['ur', 'Roman Urdu']] })}
          <button type="submit" class="btn btn-primary">Save profile</button>
        </form>
      </div>
      <div class="card card-pad">
        <div class="section-title">Appearance</div>
        <div class="settings-row" style="border:none">
          <div><div class="label">Theme</div><div class="desc">Choose how KwikSel looks on this device.</div></div>
          <div class="theme-switch" style="width:170px" role="group" aria-label="Theme">
            <button class="${theme === 'light' ? 'active' : ''}" onclick="setThemePref('light')" aria-label="Light theme">${Icon.sun}</button>
            <button class="${theme === 'dark' ? 'active' : ''}" onclick="setThemePref('dark')" aria-label="Dark theme">${Icon.moon}</button>
            <button class="${theme === 'system' ? 'active' : ''}" onclick="setThemePref('system')" aria-label="System theme">${Icon.monitor}</button>
          </div>
        </div>
      </div>
      <div class="card card-pad">
        <div class="section-title">About KwikSel</div>
        <p class="text-sm text-muted">KwikSel — Your WhatsApp Sales Desk. A local-first tool that helps small businesses capture leads, run their WhatsApp sales pipeline, and never miss a follow-up.</p>
        <p class="text-sm text-faint mt-8">Version ${APP_VERSION} • All data stays on this device — nothing is sent anywhere.</p>
      </div>
    </div>
    <div class="flex-col gap-12">
      <div class="card card-pad">
        <div class="section-title">Data management</div>
        <div class="settings-row">
          <div><div class="label">Export as JSON</div><div class="desc">Full backup of leads, templates &amp; settings.</div></div>
          <button class="btn btn-secondary btn-sm" onclick="exportJSON()">${Icon.download} Export</button>
        </div>
        <div class="settings-row">
          <div><div class="label">Export leads as CSV</div><div class="desc">Open in Excel or Google Sheets.</div></div>
          <button class="btn btn-secondary btn-sm" onclick="exportCSV()">${Icon.download} Export</button>
        </div>
        <div class="settings-row" style="border:none">
          <div><div class="label">Import from JSON</div><div class="desc">Replaces all current data. Export a backup first!</div></div>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer">${Icon.upload} Import<input type="file" accept="application/json" style="display:none" onchange="handleImportFile(event)" /></label>
        </div>
      </div>
      <div class="card card-pad danger-zone">
        <div class="section-title" style="color:var(--danger-strong)">Danger zone</div>
        <div class="settings-row" style="border:none">
          <div><div class="label">Clear all local data</div><div class="desc">Removes every lead, template, and setting from this browser.</div></div>
          <button class="btn btn-danger btn-sm" onclick="confirmClearAllData()">${Icon.trash} Clear data</button>
        </div>
      </div>
    </div>
  </div>
  `;
}
function handleBusinessFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  state.business.name = sanitizeText(fv(form, 'businessName'));
  state.business.defaultLanguage = fv(form, 'defaultLanguage');
  persist();
  showToast('Business profile saved.', 'success');
  render();
  return false;
}
function exportJSON() {
  downloadFile(`kwiksel-backup-${todayStr()}.json`, JSON.stringify(state, null, 2), 'application/json');
  showToast('Data exported as JSON.', 'success');
}
function exportCSV() {
  if (!state.leads.length) { showToast('No leads to export yet.', 'info'); return; }
  downloadFile(`kwiksel-leads-${todayStr()}.csv`, leadsToCSV(state.leads), 'text/csv');
  showToast('Leads exported as CSV.', 'success');
}
function handleImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!isValidDataShape(parsed)) throw new Error('Unexpected shape');
      openConfirm({
        title: 'Replace all data?',
        message: `This will replace all current leads, templates and settings with the contents of "${file.name}". This can't be undone.`,
        confirmLabel: 'Replace data',
        danger: true,
        onConfirm: () => {
          parsed.business = parsed.business || { name: '', defaultLanguage: 'en' };
          parsed.settings = parsed.settings || { theme: 'system' };
          state = parsed;
          persist();
          showToast('Data imported successfully.', 'success');
          render();
        },
      });
    } catch (err) {
      showToast("That file doesn't look like a valid KwikSel backup.", 'error');
    }
    e.target.value = '';
  };
  reader.onerror = () => { showToast('Could not read that file.', 'error'); e.target.value = ''; };
  reader.readAsText(file);
}
function confirmClearAllData() {
  openConfirm({
    title: 'Clear all data?',
    message: 'This permanently deletes every lead, template, and setting from this browser. This cannot be undone.',
    confirmLabel: 'Clear everything',
    danger: true,
    onConfirm: () => {
      state = { business: { name: '', defaultLanguage: 'en' }, leads: [], templates: [], settings: { theme: state.settings.theme } };
      persist();
      showToast('All local data cleared.', 'success');
      render();
    },
  });
}

/* ================================== INIT ====================================== */
render();

window.addEventListener('load', () => {
  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(() => {
      splash.style.opacity = '0';
      splash.style.visibility = 'hidden';
      setTimeout(() => splash.remove(), 600);
    }, 600);
  }
});
