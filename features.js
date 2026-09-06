/**
 * 新增功能模块：数据统计、日历视图、快速笔记
 */

(function () {
  'use strict';

  const NOTES_KEY = 'daily-desk.notes.v1';
  let notesData = loadNotes();

  function loadNotes() {
    try {
      return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveNotes() {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notesData));
  }

  function getEntries() {
    try {
      return JSON.parse(localStorage.getItem('daily-desk.entries.v2') || '[]');
    } catch {
      return [];
    }
  }

  // ========== 数据统计功能 ==========
  function initAnalytics() {
    const periodSelect = document.getElementById('analytics-period');
    if (!periodSelect) return;

    periodSelect.addEventListener('change', updateAnalytics);
    updateAnalytics();
  }

  function updateAnalytics() {
    const period = document.getElementById('analytics-period')?.value || 'month';
    const entries = getEntries().filter(e => !e.deletedAt);
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const filteredEntries = entries.filter(e => new Date(e.date) >= startDate);

    // 计算总览数据
    const totalHours = filteredEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
    const totalEntries = filteredEntries.length;
    const avgHours = totalEntries > 0 ? (totalHours / totalEntries).toFixed(1) : 0;
    const completedCount = filteredEntries.filter(e => e.status === 'done').length;
    const completionRate = totalEntries > 0 ? Math.round((completedCount / totalEntries) * 100) : 0;

    document.getElementById('total-hours').textContent = totalHours.toFixed(1) + 'h';
    document.getElementById('total-entries').textContent = totalEntries;
    document.getElementById('avg-hours').textContent = avgHours + 'h';
    document.getElementById('completion-rate').textContent = completionRate + '%';

    // 更新期间标签
    const labels = {
      week: '本周',
      month: `${now.getFullYear()}年${now.getMonth() + 1}月`,
      quarter: `${now.getFullYear()}年Q${Math.floor(now.getMonth() / 3) + 1}`,
      year: `${now.getFullYear()}年`
    };
    const labelEl = document.getElementById('analytics-period-label');
    if (labelEl) labelEl.textContent = labels[period];

    // 绘制图表
    drawHoursChart(filteredEntries, period);

    // 项目分布
    updateProjectStats(filteredEntries);

    // 标签云
    updateTagsCloud(filteredEntries);
  }

  function drawHoursChart(entries, period) {
    const canvas = document.getElementById('hours-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    ctx.clearRect(0, 0, width, height);

    if (entries.length === 0) {
      ctx.fillStyle = '#9ca3b4';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', width / 2, height / 2);
      return;
    }

    // 按日期分组
    const dataMap = {};
    entries.forEach(e => {
      const date = e.date;
      dataMap[date] = (dataMap[date] || 0) + (e.hours || 0);
    });

    const dates = Object.keys(dataMap).sort();
    const values = dates.map(d => dataMap[d]);
    const maxValue = Math.max(...values, 1);

    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const barWidth = chartWidth / dates.length;

    // 绘制网格线
    ctx.strokeStyle = '#eff2f8';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // 绘制柱状图
    dates.forEach((date, index) => {
      const value = values[index];
      const barHeight = (value / maxValue) * chartHeight;
      const x = padding + index * barWidth;
      const y = padding + chartHeight - barHeight;

      const gradient = ctx.createLinearGradient(x, y, x, padding + chartHeight);
      gradient.addColorStop(0, '#4f6bef');
      gradient.addColorStop(1, '#6b82f3');

      ctx.fillStyle = gradient;
      ctx.fillRect(x + barWidth * 0.2, y, barWidth * 0.6, barHeight);

      // 显示数值
      if (value > 0) {
        ctx.fillStyle = '#1a2332';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(value.toFixed(1) + 'h', x + barWidth / 2, y - 5);
      }
    });

    // 绘制日期标签（只显示部分）
    ctx.fillStyle = '#6b7585';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const step = Math.ceil(dates.length / 10);
    dates.forEach((date, index) => {
      if (index % step === 0) {
        const x = padding + index * barWidth + barWidth / 2;
        const label = date.split('-').slice(1).join('/');
        ctx.fillText(label, x, height - padding + 20);
      }
    });
  }

  function updateProjectStats(entries) {
    const projectMap = {};
    entries.forEach(e => {
      if (!e.project) return;
      projectMap[e.project] = (projectMap[e.project] || 0) + (e.hours || 0);
    });

    const projects = Object.entries(projectMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const container = document.getElementById('project-list');
    if (!container) return;

    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-chart"><span>📊</span><p>暂无项目数据</p></div>';
      return;
    }

    const maxHours = Math.max(...projects.map(p => p[1]));
    const colors = ['#4f6bef', '#52d9a2', '#ff9f5a', '#9b7ef9', '#ff6b6b'];

    container.innerHTML = projects.map(([name, hours], index) => `
      <div class="project-item">
        <span class="project-color" style="background:${colors[index % colors.length]}"></span>
        <div class="project-info">
          <strong class="project-name">${escapeHtml(name)}</strong>
          <span class="project-hours">${hours.toFixed(1)}小时</span>
          <div class="project-bar">
            <div class="project-bar-fill" style="width:${(hours / maxHours) * 100}%"></div>
          </div>
        </div>
      </div>
    `).join('');
  }

  function updateTagsCloud(entries) {
    const tagMap = {};
    entries.forEach(e => {
      if (!e.tags || !Array.isArray(e.tags)) return;
      e.tags.forEach(tag => {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });

    const tags = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const container = document.getElementById('tags-cloud');
    if (!container) return;

    if (tags.length === 0) {
      container.innerHTML = '<div class="empty-chart"><span>🏷️</span><p>暂无标签数据</p></div>';
      return;
    }

    const maxCount = Math.max(...tags.map(t => t[1]));
    container.innerHTML = tags.map(([tag, count]) => {
      const size = 11 + Math.round((count / maxCount) * 6);
      return `<span class="tag-bubble" style="font-size:${size}px">${escapeHtml(tag)} <span class="tag-count">${count}</span></span>`;
    }).join('');
  }

  // ========== 日历视图功能 ==========
  function initCalendar() {
    let currentMonth = new Date();

    function renderCalendar() {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();

      document.getElementById('calendar-month').textContent =
        `${year}年${month + 1}月`;

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startDay = firstDay.getDay();

      const entries = getEntries().filter(e => !e.deletedAt);
      const entryMap = {};
      entries.forEach(e => {
        entryMap[e.date] = e;
      });

      const daysContainer = document.getElementById('calendar-days');
      if (!daysContainer) return;

      let html = '';

      // 前置空白
      for (let i = 0; i < startDay; i++) {
        const prevDate = new Date(year, month, -startDay + i + 1);
        html += `<div class="calendar-day other-month"><span class="calendar-day-number">${prevDate.getDate()}</span></div>`;
      }

      // 当月日期
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDate(date);
        const entry = entryMap[dateStr];
        const isToday = dateStr === formatDate(new Date());

        let classes = ['calendar-day'];
        if (isToday) classes.push('today');
        if (entry) classes.push('has-entry');

        html += `<div class="${classes.join(' ')}" data-date="${dateStr}">
          <span class="calendar-day-number">${day}</span>
          <div class="calendar-day-content">
            ${entry ? `
              <div class="calendar-day-hours">⏱ ${entry.hours || 0}h</div>
              <div style="font-size:10px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(entry.title || '无标题')}</div>
            ` : ''}
          </div>
        </div>`;
      }

      daysContainer.innerHTML = html;

      // 绑定点击事件
      daysContainer.querySelectorAll('.calendar-day[data-date]').forEach(el => {
        el.addEventListener('click', () => {
          const date = el.dataset.date;
          showCalendarDetail(date, entryMap[date]);
        });
      });
    }

    function showCalendarDetail(date, entry) {
      const panel = document.getElementById('calendar-detail-panel');
      if (!panel) return;

      const dateObj = new Date(date);
      const label = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;

      document.getElementById('calendar-detail-date').textContent = label;

      const content = document.getElementById('calendar-detail-content');
      if (!entry) {
        content.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px">这天没有记录</p>';
      } else {
        content.innerHTML = `
          <div style="display:grid;gap:16px">
            <div>
              <strong style="font-size:18px;color:var(--ink)">${escapeHtml(entry.title || '无标题')}</strong>
              <div style="margin-top:8px;display:flex;gap:16px;font-size:12px;color:var(--muted)">
                <span>⏱ ${entry.hours || 0}小时</span>
                <span>状态：${entry.status === 'done' ? '✓ 已完成' : entry.status === 'progress' ? '⟳ 进行中' : '○ 待开始'}</span>
              </div>
            </div>
            ${entry.details ? `<div style="line-height:1.7;color:var(--muted)">${escapeHtml(entry.details).replace(/\n/g, '<br>')}</div>` : ''}
            ${entry.next ? `<div><strong style="font-size:13px">下一步：</strong><br><span style="color:var(--muted)">${escapeHtml(entry.next)}</span></div>` : ''}
            ${entry.blocker ? `<div><strong style="font-size:13px;color:var(--orange)">阻碍：</strong><br><span style="color:var(--muted)">${escapeHtml(entry.blocker)}</span></div>` : ''}
          </div>
        `;
      }

      panel.style.display = 'block';
    }

    document.getElementById('cal-prev-month')?.addEventListener('click', () => {
      currentMonth.setMonth(currentMonth.getMonth() - 1);
      renderCalendar();
    });

    document.getElementById('cal-next-month')?.addEventListener('click', () => {
      currentMonth.setMonth(currentMonth.getMonth() + 1);
      renderCalendar();
    });

    document.getElementById('cal-today')?.addEventListener('click', () => {
      currentMonth = new Date();
      renderCalendar();
    });

    document.getElementById('close-calendar-detail')?.addEventListener('click', () => {
      document.getElementById('calendar-detail-panel').style.display = 'none';
    });

    renderCalendar();
  }

  // ========== 快速笔记功能 ==========
  function initNotes() {
    renderNotes();

    document.getElementById('add-note')?.addEventListener('click', () => {
      document.getElementById('note-composer').scrollIntoView({ behavior: 'smooth' });
      document.getElementById('note-title').focus();
    });

    document.getElementById('save-note')?.addEventListener('click', saveNote);

    document.getElementById('notes-search')?.addEventListener('input', filterNotes);
    document.getElementById('notes-sort')?.addEventListener('change', renderNotes);
  }

  function saveNote() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const tagsInput = document.getElementById('note-tags').value.trim();

    if (!title && !content) {
      notify('请输入笔记内容');
      return;
    }

    const note = {
      id: Date.now().toString(),
      title: title || '无标题',
      content,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    notesData.unshift(note);
    saveNotes();
    renderNotes();

    // 清空输入
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    document.getElementById('note-tags').value = '';

    notify('笔记已保存');
  }

  function deleteNote(id) {
    if (!confirm('确定要删除这条笔记吗？')) return;
    notesData = notesData.filter(n => n.id !== id);
    saveNotes();
    renderNotes();
    notify('笔记已删除');
  }

  function filterNotes() {
    const query = document.getElementById('notes-search').value.toLowerCase();
    const notes = document.querySelectorAll('.note-card');

    notes.forEach(note => {
      const text = note.textContent.toLowerCase();
      note.style.display = text.includes(query) ? '' : 'none';
    });
  }

  function renderNotes() {
    const container = document.getElementById('notes-list');
    if (!container) return;

    const sortBy = document.getElementById('notes-sort')?.value || 'newest';
    let sorted = [...notesData];

    switch (sortBy) {
      case 'oldest':
        sorted.reverse();
        break;
      case 'updated':
        sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        break;
    }

    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><h3>还没有笔记</h3><p>点击上方按钮创建你的第一条笔记。</p></div>';
      return;
    }

    container.innerHTML = sorted.map(note => `
      <div class="note-card" data-id="${note.id}">
        <div class="note-header">
          <h3 class="note-title">${escapeHtml(note.title)}</h3>
          <button class="note-menu-btn" onclick="window.deleteNote('${note.id}')">×</button>
        </div>
        <div class="note-content">${escapeHtml(note.content)}</div>
        <div class="note-footer">
          <span class="note-time">${formatDateTime(note.createdAt)}</span>
          <div class="note-tags">
            ${note.tags.map(tag => `<span class="note-tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      </div>
    `).join('');
  }

  // ========== 工具函数 ==========
  function formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  function formatDateTime(iso) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function notify(text) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2400);
  }

  // 暴露全局函数
  window.deleteNote = deleteNote;

  // 监听视图切换
  const observer = new MutationObserver(() => {
    const activeView = document.querySelector('.view.active');
    if (!activeView) return;

    const viewId = activeView.id;
    if (viewId === 'view-analytics') {
      updateAnalytics();
    } else if (viewId === 'view-calendar') {
      initCalendar();
    } else if (viewId === 'view-notes') {
      initNotes();
    }
  });

  // 初始化
  document.addEventListener('DOMContentLoaded', () => {
    initAnalytics();
    initCalendar();
    initNotes();

    // 监听视图变化
    const viewContainer = document.querySelector('.main-content');
    if (viewContainer) {
      observer.observe(viewContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  });
})();
