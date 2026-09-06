(function () {
  'use strict';

  const KEY = 'daily-desk.entries.v2';
  const OLD_KEY = 'daily-desk.entries.v1';
  const DRAFT_KEY = 'daily-desk.draft.v1';
  const SETTINGS_KEY = 'daily-desk.settings.v1';
  const DELETED_KEY = 'daily-desk.deleted.v1';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const fallbackSettings = { browserReminder: false, reminderTime: '18:00', weekends: 'include' };

  const state = {
    entries: load(KEY, load(OLD_KEY, [])),
    deleted: load(DELETED_KEY, []),
    settings: { ...fallbackSettings, ...load(SETTINGS_KEY, {}) },
    selectedDate: formatDate(new Date()),
    weekOffset: 0,
    theme: localStorage.getItem('daily-desk.theme') || 'light',
    supabase: null,
    user: null,
    cloudReady: false,
    reminderTimer: null
  };

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }
  function formatDate(value) {
    const d = value instanceof Date ? value : new Date(value);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function parseDate(value) {
    const [y, m, d] = String(value).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function dateLabel(value) {
    const d = value instanceof Date ? value : parseDate(value);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}`;
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function statusLabel(value) { return value === 'done' ? '已完成' : value === 'todo' ? '待开始' : '进行中'; }
  function getEntry(date) { return state.entries.find((entry) => entry.date === date && !entry.deletedAt); }
  function saveLocal() {
    localStorage.setItem(KEY, JSON.stringify(state.entries));
    localStorage.setItem(DELETED_KEY, JSON.stringify(state.deleted));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  }
  function notify(text) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => el.classList.remove('show'), 2400);
  }
  function weekStart(offset = state.weekOffset) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
    return d;
  }
  function weekEntries(offset = state.weekOffset) {
    const start = weekStart(offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return state.entries.filter((entry) => !entry.deletedAt && parseDate(entry.date) >= start && parseDate(entry.date) < end)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function setSyncStatus(kind = 'local') {
    const card = $('.sync-card');
    if (!card) return;
    card.classList.remove('offline', 'error');
    if (kind === 'cloud') { $('#sync-status').textContent = '已同步'; $('.sync-card small').textContent = state.user?.email || '云端数据已更新'; }
    else if (kind === 'syncing') { $('#sync-status').textContent = '同步中…'; $('.sync-card small').textContent = '正在连接云端'; }
    else if (kind === 'error') { $('#sync-status').textContent = '同步失败'; $('.sync-card small').textContent = '已保存在本机，稍后重试'; card.classList.add('error'); }
    else if (state.cloudReady) { $('#sync-status').textContent = '等待登录'; $('.sync-card small').textContent = '登录后开启跨设备同步'; }
    else { $('#sync-status').textContent = '本地保存'; $('.sync-card small').textContent = '数据保存在当前设备'; card.classList.add('offline'); }
  }

  function readForm() {
    return {
      date: state.selectedDate,
      title: $('#entry-title').value.trim(),
      details: $('#entry-details').value.trim(),
      hours: Math.max(0, Math.min(24, Number($('#entry-hours').value) || 0)),
      status: document.querySelector('input[name="status"]:checked')?.value || 'progress',
      next: $('#entry-next').value.trim(),
      blocker: $('#entry-blocker').value.trim(),
      project: $('#entry-project').value.trim(),
      tags: $('#entry-tags').value.split(',').map((tag) => tag.trim()).filter(Boolean),
      updatedAt: new Date().toISOString()
    };
  }
  function fillForm(date) {
    state.selectedDate = date;
    $('#entry-date').value = date;
    const entry = getEntry(date) || {};
    $('#entry-title').value = entry.title || '';
    $('#entry-details').value = entry.details || '';
    $('#entry-hours').value = entry.hours ?? '';
    $('#entry-next').value = entry.next || entry.next_step || '';
    $('#entry-blocker').value = entry.blocker || '';
    $('#entry-project').value = entry.project || '';
    $('#entry-tags').value = Array.isArray(entry.tags) ? entry.tags.join(', ') : (entry.tags || '');
    const radio = document.querySelector(`input[name="status"][value="${entry.status || 'progress'}"]`);
    if (radio) radio.checked = true;
    $('#today-label').textContent = `TODAY · ${dateLabel(date)}`;
    renderStats();
  }
  function saveDraft() {
    const draft = readForm();
    draft.savedAt = Date.now();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }
  function restoreDraft() {
    const draft = load(DRAFT_KEY, null);
    if (!draft || draft.date !== state.selectedDate || getEntry(draft.date) || Date.now() - draft.savedAt > 86400000) return;
    $('#entry-title').value = draft.title || '';
    $('#entry-details').value = draft.details || '';
    $('#entry-hours').value = draft.hours || '';
    $('#entry-next').value = draft.next || '';
    $('#entry-blocker').value = draft.blocker || '';
    $('#entry-project').value = draft.project || '';
    $('#entry-tags').value = (draft.tags || []).join(', ');
    notify('已恢复未保存草稿');
  }
  async function saveEntry() {
    const entry = readForm();
    if (!entry.title && !entry.details) { notify('请先填写今日主题或工作详情'); return; }
    const index = state.entries.findIndex((item) => item.date === entry.date);
    if (index >= 0) state.entries[index] = { ...state.entries[index], ...entry, deletedAt: null };
    else state.entries.push(entry);
    state.entries.sort((a, b) => b.date.localeCompare(a.date));
    saveLocal();
    localStorage.removeItem(DRAFT_KEY);
    renderAll();
    if (state.user) await pushCloud(entry);
    notify('记录已保存');
  }

  function renderStats() {
    const entries = weekEntries();
    const hours = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    const done = entries.filter((entry) => entry.status === 'done').length;
    $('#week-hours').textContent = `${hours}h`;
    $('#week-done').textContent = done;
    $('#week-days').textContent = entries.length;
    $('#week-progress-text').textContent = `${Math.min(entries.length, 5)} / 5 天`;
    $('#week-progress-bar').style.width = `${Math.min(entries.length / 5 * 100, 100)}%`;
  }
  function renderFilters() {
    const months = [...new Set(state.entries.map((entry) => entry.date.slice(0, 7)))].sort().reverse();
    const projects = [...new Set(state.entries.map((entry) => entry.project).filter(Boolean))].sort();
    const month = $('#month-filter');
    const project = $('#project-filter');
    const oldMonth = month.value, oldProject = project.value;
    month.innerHTML = '<option value="all">全部月份</option>' + months.map((value) => `<option value="${value}">${value.replace('-', '年')}月</option>`).join('');
    project.innerHTML = '<option value="all">全部项目</option>' + projects.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    if (months.includes(oldMonth)) month.value = oldMonth;
    if (projects.includes(oldProject)) project.value = oldProject;
  }
  function renderHistory() {
    const query = ($('#search-input').value || '').toLowerCase();
    const month = $('#month-filter').value;
    const project = $('#project-filter').value;
    const rows = state.entries.filter((entry) => !entry.deletedAt &&
      (!query || `${entry.title} ${entry.details} ${entry.project || ''} ${(entry.tags || []).join(' ')}`.toLowerCase().includes(query)) &&
      (month === 'all' || entry.date.startsWith(month)) && (project === 'all' || entry.project === project));
    const list = $('#history-list');
    list.innerHTML = '';
    $('#history-empty').classList.toggle('hidden', rows.length > 0);
    rows.forEach((entry) => {
      const d = parseDate(entry.date);
      const row = document.createElement('div');
      row.className = 'history-row';
      row.innerHTML = `<div class="history-date"><strong>${String(d.getDate()).padStart(2, '0')}</strong>${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}</div><div class="history-content"><strong>${escapeHtml(entry.title || '未命名记录')}</strong><small>${escapeHtml(entry.details || '暂无详情')}</small>${entry.project ? `<div class="history-project">${escapeHtml(entry.project)}</div>` : ''}<div class="tag-list">${(entry.tags || []).slice(0, 4).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}</div></div><div class="history-hours">${entry.hours ? `${entry.hours}h` : '—'}</div><div class="status-label"><span class="status-dot ${entry.status || 'progress'}"></span>${statusLabel(entry.status)}</div><div class="row-actions"><button class="more-btn" data-menu="${entry.date}">···</button><div class="row-menu" id="menu-${entry.date}"><button data-edit="${entry.date}">编辑记录</button><button data-export="${entry.date}">导出当天</button><button data-delete="${entry.date}">删除</button></div></div>`;
      list.appendChild(row);
    });
  }
  function renderWeekly() {
    const entries = weekEntries();
    const start = weekStart();
    const end = new Date(start); end.setDate(end.getDate() + 6);
    $('#week-range').textContent = `${dateLabel(start)} — ${end.getMonth() + 1}月${end.getDate()}日`;
    const hours = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    const completed = entries.filter((entry) => entry.status === 'done').length;
    $('#weekly-hours').textContent = `${hours}h`;
    $('#weekly-completed').textContent = completed;
    $('#weekly-active').textContent = entries.filter((entry) => entry.status === 'progress').length;
    $('#weekly-summary-sub').textContent = `已记录 ${entries.length} 天 · 共投入 ${hours} 小时`;
    const percent = entries.length ? Math.round(completed / entries.length * 100) : 0;
    $('#completion-ring').textContent = `${percent}%`;
    const highlights = $('#highlights-list'); highlights.innerHTML = '';
    (completed ? entries.filter((entry) => entry.status === 'done') : entries).slice(0, 5).forEach((entry) => { const li = document.createElement('li'); li.textContent = entry.title; highlights.appendChild(li); });
    if (!highlights.children.length) highlights.innerHTML = '<li class="muted-item">完成记录后，这里会自动生成亮点。</li>';
    const blockers = $('#blockers-list'); blockers.innerHTML = '';
    entries.filter((entry) => entry.blocker).forEach((entry) => { const li = document.createElement('li'); li.className = 'blocker'; li.textContent = `${entry.blocker}（${entry.title}）`; blockers.appendChild(li); });
    if (!blockers.children.length) blockers.innerHTML = '<li class="muted-item">暂无待跟进事项。</li>';
    const timeline = $('#weekly-timeline-list'); timeline.innerHTML = '';
    entries.forEach((entry) => { const d = parseDate(entry.date), item = document.createElement('div'); item.className = `timeline-item ${entry.status || 'progress'}`; item.innerHTML = `<div class="timeline-date">${d.getMonth() + 1}/${d.getDate()} · ${['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}</div><div class="timeline-node"></div><div class="timeline-content"><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.details || '暂无详情')}</small></div>`; timeline.appendChild(item); });
    if (!timeline.children.length) timeline.innerHTML = '<div class="empty-state"><div class="empty-icon">☼</div><p>这一周还没有记录。</p></div>';
  }
  function renderAll() { renderFilters(); renderHistory(); renderStats(); renderWeekly(); }

  function exportRange() {
    const start = $('#range-start')?.value || formatDate(weekStart());
    const end = $('#range-end')?.value || formatDate(new Date(weekStart().getTime() + 6 * 86400000));
    return { start: start <= end ? start : end, end: start <= end ? end : start, options: { details: $('#export-include-details')?.checked !== false, hours: $('#export-include-hours')?.checked !== false, followup: $('#export-include-followup')?.checked !== false } };
  }
  function setRangeFromWeek() { const start = weekStart(); const end = new Date(start); end.setDate(end.getDate() + 6); if ($('#range-start')) $('#range-start').value = formatDate(start); if ($('#range-end')) $('#range-end').value = formatDate(end); }
  function download(name, content, type = 'text/plain;charset=utf-8') { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 800); }
  function markdownOne(entry) { return DailyDeskExports.markdown([entry], entry.date, entry.date); }

  function updateAccountUi() {
    const logged = Boolean(state.user);
    $('#account-button').textContent = logged ? (state.user.email || '我').slice(0, 1).toUpperCase() : '我';
    $('#account-button').title = logged ? state.user.email : '登录';
    $('#auth-status').textContent = logged ? `已登录：${state.user.email || 'Google 账号'}` : (state.cloudReady ? '尚未登录。' : '当前为本地模式。配置 Supabase 后启用登录。');
    $('#sign-out').classList.toggle('hidden', !logged);
    $('#migrate-local').classList.toggle('hidden', !logged);
  }
  function cloudRow(entry) { return { user_id: state.user.id, date: entry.date, title: entry.title, details: entry.details, hours: entry.hours, status: entry.status, next_step: entry.next || '', blocker: entry.blocker || '', project: entry.project || '', tags: entry.tags || [], updated_at: entry.updatedAt || new Date().toISOString(), deleted_at: null }; }
  function localRow(row) { return { ...row, next: row.next_step || row.next || '', project: row.project || '', tags: Array.isArray(row.tags) ? row.tags : (row.tags ? String(row.tags).split(',').map((tag) => tag.trim()).filter(Boolean) : []), updatedAt: row.updated_at || row.updatedAt }; }
  async function initCloud() {
    const config = window.DAILY_DESK_CONFIG || {};
    if (!config.supabaseUrl || !config.supabaseAnonKey) { setSyncStatus(); return; }
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey); state.cloudReady = true;
      const session = await state.supabase.auth.getSession(); state.user = session.data.session?.user || null;
      state.supabase.auth.onAuthStateChange((_event, authSession) => { state.user = authSession?.user || null; updateAccountUi(); if (state.user) pullCloud(); else setSyncStatus(); });
      updateAccountUi(); setSyncStatus(); if (state.user) await pullCloud();
    } catch (error) { console.error(error); setSyncStatus('error'); }
  }
  async function pullCloud() {
    if (!state.supabase || !state.user) return;
    setSyncStatus('syncing');
    try {
      const { data, error } = await state.supabase.from('daily_entries').select('*').eq('user_id', state.user.id).is('deleted_at', null).order('date', { ascending: false });
      if (error) throw error;
      const cloud = (data || []).map(localRow);
      const localOnly = state.entries.filter((entry) => !cloud.some((row) => row.date === entry.date));
      const map = new Map(); [...cloud, ...localOnly].forEach((entry) => { const old = map.get(entry.date); if (!old || new Date(entry.updatedAt || 0) < new Date(entry.updatedAt || 0)) map.set(entry.date, entry); });
      state.entries = [...map.values()].sort((a, b) => b.date.localeCompare(a.date)); saveLocal(); renderAll(); setSyncStatus('cloud');
      if (!cloud.length && localOnly.length) notify('检测到本机记录，可在设置中迁移到云端');
    } catch (error) { console.error(error); setSyncStatus('error'); }
  }
  async function pushCloud(entry) { if (!state.supabase || !state.user) return; try { setSyncStatus('syncing'); const { error } = await state.supabase.from('daily_entries').upsert(cloudRow(entry), { onConflict: 'user_id,date' }); if (error) throw error; setSyncStatus('cloud'); } catch (error) { console.error(error); setSyncStatus('error'); } }
  async function login() { if (!state.supabase) { notify('请先在 config.js 配置 Supabase'); return; } const { error } = await state.supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }); if (error) notify(`登录失败：${error.message}`); }
  async function logout() { if (state.supabase) await state.supabase.auth.signOut(); state.user = null; updateAccountUi(); setSyncStatus(); notify('已退出登录'); }
  async function migrateLocal() { if (!state.user) { notify('请先登录'); return; } const rows = state.entries.filter((entry) => !entry.deletedAt); if (!rows.length) { notify('本机没有可迁移的记录'); return; } const { error } = await state.supabase.from('daily_entries').upsert(rows.map(cloudRow), { onConflict: 'user_id,date' }); if (error) { setSyncStatus('error'); notify('迁移失败，请检查 Supabase 配置'); return; } setSyncStatus('cloud'); notify(`已迁移 ${rows.length} 条记录`); }

  function scheduleReminder() {
    clearTimeout(state.reminderTimer);
    if (!state.settings.browserReminder || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date(); const [hours, minutes] = state.settings.reminderTime.split(':').map(Number); const target = new Date(now); target.setHours(hours, minutes, 0, 0); if (target <= now) target.setDate(target.getDate() + 1);
    state.reminderTimer = setTimeout(() => { const weekend = [0, 6].includes(new Date().getDay()); if (!(weekend && state.settings.weekends === 'skip') && !getEntry(formatDate(new Date()))) new Notification('每日工作台提醒', { body: '今天还没有记录，花几分钟写下你的工作进展吧。' }); scheduleReminder(); }, target - now);
  }
  function updateSettingsUi() { $('#browser-reminder').checked = state.settings.browserReminder; $('#reminder-time').value = state.settings.reminderTime; $('#reminder-weekends').value = state.settings.weekends; }
  function switchView(view) { $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view)); $$('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${view}`)); if (view === 'history') renderHistory(); if (view === 'weekly') renderWeekly(); }

  function bindEvents() {
    $$('.nav-item').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
    $$('[data-view-target]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.viewTarget)));
    $('#save-entry').addEventListener('click', saveEntry);
    $('#entry-form').addEventListener('input', saveDraft);
    $('#entry-date').addEventListener('change', (event) => { fillForm(event.target.value); restoreDraft(); });
    $('#search-input').addEventListener('input', renderHistory); $('#month-filter').addEventListener('change', renderHistory); $('#project-filter').addEventListener('change', renderHistory);
    $('#prev-week').addEventListener('click', () => { state.weekOffset -= 1; setRangeFromWeek(); renderWeekly(); }); $('#next-week').addEventListener('click', () => { state.weekOffset += 1; setRangeFromWeek(); renderWeekly(); }); $('#current-week').addEventListener('click', () => { state.weekOffset = 0; setRangeFromWeek(); renderWeekly(); });
    $('#copy-yesterday').addEventListener('click', () => { const d = parseDate(state.selectedDate); d.setDate(d.getDate() - 1); const entry = getEntry(formatDate(d)); if (!entry) { notify('昨天没有可复制的记录'); return; } $('#entry-title').value = entry.title || ''; $('#entry-details').value = entry.details || ''; $('#entry-hours').value = entry.hours || ''; $('#entry-next').value = entry.next || ''; $('#entry-blocker').value = entry.blocker || ''; $('#entry-project').value = entry.project || ''; $('#entry-tags').value = (entry.tags || []).join(', '); notify('已复制昨天记录，请按保存'); });
    $('#entry-template').addEventListener('change', (event) => { const template = { meeting: ['会议记录', '会议目标：\n结论：\n待办：'], development: ['开发任务', '完成内容：\n测试结果：\n风险：'], communication: ['客户沟通', '沟通对象：\n核心信息：\n下一步：'], learning: ['学习总结', '学习主题：\n关键收获：\n实践计划：'] }[event.target.value]; if (template) { $('#entry-title').value = template[0]; $('#entry-details').value = template[1]; saveDraft(); } event.target.value = ''; });
    $('#export-all').addEventListener('click', () => download('每日工作记录.json', JSON.stringify(state.entries.filter((entry) => !entry.deletedAt), null, 2), 'application/json;charset=utf-8'));
    $('#export-weekly').addEventListener('click', () => { const range = exportRange(); download(`工作报告-${range.start}-${range.end}.md`, DailyDeskExports.markdown(state.entries, range.start, range.end, range.options)); });
    $('#export-weekly-pdf').addEventListener('click', () => { const range = exportRange(); DailyDeskExports.exportPdf(state.entries, range.start, range.end, range.options); });
    $('#export-weekly-xlsx').addEventListener('click', () => { const range = exportRange(); DailyDeskExports.exportXlsx(state.entries, range.start, range.end, { ...range.options, filename: `工作报告-${range.start}-${range.end}.xlsx` }); });
    $('#copy-weekly').addEventListener('click', async () => { const range = exportRange(); await navigator.clipboard?.writeText(DailyDeskExports.markdown(state.entries, range.start, range.end, range.options)); notify('周报已复制到剪贴板'); });
    $('#history-list').addEventListener('click', (event) => { const menu = event.target.closest('[data-menu]'); if (menu) { $$('.row-menu').forEach((item) => item.classList.remove('show')); $(`#menu-${menu.dataset.menu}`).classList.toggle('show'); return; } const edit = event.target.closest('[data-edit]'), remove = event.target.closest('[data-delete]'), exportButton = event.target.closest('[data-export]'); if (edit) { fillForm(edit.dataset.edit); switchView('today'); } if (remove) { const item = getEntry(remove.dataset.delete); if (item) { item.deletedAt = new Date().toISOString(); state.deleted.push(item); state.entries = state.entries.filter((entry) => entry.date !== item.date); saveLocal(); renderAll(); notify('已移入最近删除'); } } if (exportButton) { const item = getEntry(exportButton.dataset.export); if (item) download(`工作记录-${item.date}.md`, markdownOne(item)); } });
    $('#show-deleted').addEventListener('click', () => { const item = state.deleted.at(-1); if (!item) { notify('最近没有删除的记录'); return; } delete item.deletedAt; state.entries.push(item); state.deleted = state.deleted.filter((entry) => entry.date !== item.date); saveLocal(); renderAll(); notify('已恢复最近删除的记录'); });
    $('#theme-toggle').addEventListener('click', () => { state.theme = state.theme === 'light' ? 'dim' : 'light'; localStorage.setItem('daily-desk.theme', state.theme); document.body.dataset.theme = state.theme; });
    $('#open-settings').addEventListener('click', () => { updateSettingsUi(); $('#settings-modal').classList.remove('hidden'); $('#config-status').textContent = state.user ? `已登录：${state.user.email || 'Google 账号'}，数据会自动同步。` : state.cloudReady ? '已检测到 Supabase 配置，请登录以开启云端同步。' : '当前为本地保存模式。请在 config.js 配置 Supabase URL 和 anon key。'; });
    $('#close-settings').addEventListener('click', () => $('#settings-modal').classList.add('hidden')); $('#settings-modal').addEventListener('click', (event) => { if (event.target.id === 'settings-modal') event.currentTarget.classList.add('hidden'); });
    $('#clear-data').addEventListener('click', () => { if (confirm('确定要清空当前设备的所有记录吗？')) { state.entries = []; saveLocal(); renderAll(); $('#settings-modal').classList.add('hidden'); notify('本机记录已清空'); } }); $('#migrate-local').addEventListener('click', migrateLocal); $('#sign-out').addEventListener('click', logout);
    $('#enable-notifications').addEventListener('click', async () => { if (!('Notification' in window)) { notify('当前浏览器不支持通知'); return; } const permission = await Notification.requestPermission(); notify(permission === 'granted' ? '浏览器通知已开启' : '通知权限未开启'); scheduleReminder(); }); $('#browser-reminder').addEventListener('change', (event) => { state.settings.browserReminder = event.target.checked; saveLocal(); scheduleReminder(); }); $('#reminder-time').addEventListener('change', (event) => { state.settings.reminderTime = event.target.value; saveLocal(); scheduleReminder(); }); $('#reminder-weekends').addEventListener('change', (event) => { state.settings.weekends = event.target.value; saveLocal(); scheduleReminder(); });
    $('#account-button').addEventListener('click', () => { updateAccountUi(); $('#account-modal').classList.remove('hidden'); }); $('#close-account').addEventListener('click', () => $('#account-modal').classList.add('hidden')); $('#google-login').addEventListener('click', login); $('#account-modal').addEventListener('click', (event) => { if (event.target.id === 'account-modal') event.currentTarget.classList.add('hidden'); });
  }

  document.body.dataset.theme = state.theme;
  bindEvents();
  fillForm(state.selectedDate);
  restoreDraft();
  setRangeFromWeek();
  renderAll();
  updateSettingsUi();
  updateAccountUi();
  setSyncStatus();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('/sw.js').catch(() => {});
  initCloud();
  scheduleReminder();
}());
