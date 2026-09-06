/**
 * 完整笔记系统 - 支持 Markdown、分类、收藏、搜索
 */

(function () {
  'use strict';

  const NOTES_KEY = 'daily-desk.notes.v2';
  const CATEGORIES_KEY = 'daily-desk.categories.v1';

  let notes = loadNotes();
  let categories = loadCategories();
  let currentNote = null;
  let currentCategory = 'all';
  let currentFilter = '';
  let editorMode = 'edit'; // edit, preview, both

  function loadNotes() {
    try {
      return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveNotes() {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    updateStats();
    renderNotesList();
  }

  function loadCategories() {
    try {
      const defaults = [
        { id: 'work', name: '工作', icon: '💼' },
        { id: 'personal', name: '个人', icon: '🏠' },
        { id: 'learning', name: '学习', icon: '📚' },
      ];
      return JSON.parse(localStorage.getItem(CATEGORIES_KEY) || JSON.stringify(defaults));
    } catch {
      return [];
    }
  }

  function saveCategories() {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    renderCategories();
  }

  // ========== 初始化 ==========
  function initNotesSystem() {
    renderCategories();
    renderNotesList();
    updateStats();
    bindEvents();
    renderSidebarTags();
  }

  function bindEvents() {
    // 新建笔记
    document.getElementById('add-note')?.addEventListener('click', createNewNote);

    // 分类切换
    document.querySelectorAll('.category-item').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCategory = btn.dataset.category;
        document.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderNotesList();
      });
    });

    // 新建分类
    document.getElementById('add-category')?.addEventListener('click', addCategory);

    // 搜索
    document.getElementById('notes-search')?.addEventListener('input', (e) => {
      currentFilter = e.target.value.toLowerCase();
      renderNotesList();
    });

    // 排序
    document.getElementById('notes-sort')?.addEventListener('change', renderNotesList);

    // 视图切换
    document.getElementById('notes-view-toggle')?.addEventListener('click', toggleView);

    // 编辑器相关
    document.getElementById('close-editor')?.addEventListener('click', closeEditor);
    document.getElementById('save-note-editor')?.addEventListener('click', saveCurrentNote);
    document.getElementById('discard-note')?.addEventListener('click', discardNote);
    document.getElementById('toggle-starred')?.addEventListener('click', toggleStarred);

    // 编辑器标签页
    document.querySelectorAll('.editor-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        editorMode = tab.dataset.tab;
        switchEditorMode();
      });
    });

    // 工具栏按钮
    document.querySelectorAll('.editor-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        applyFormat(action);
      });
    });

    // 实时预览
    const textarea = document.getElementById('edit-note-content');
    if (textarea) {
      textarea.addEventListener('input', () => {
        updateWordCount();
        if (editorMode === 'both') {
          updatePreview();
        }
      });
    }

    // 自动保存
    setInterval(() => {
      if (currentNote && document.getElementById('notes-editor').classList.contains('hidden') === false) {
        autoSave();
      }
    }, 30000); // 每30秒自动保存

    // 快捷键
    document.addEventListener('keydown', handleKeyboard);
  }

  function handleKeyboard(e) {
    // Ctrl/Cmd + S: 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentNote();
    }
    // Ctrl/Cmd + B: 粗体
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      applyFormat('bold');
    }
    // Ctrl/Cmd + I: 斜体
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      applyFormat('italic');
    }
    // Escape: 关闭编辑器
    if (e.key === 'Escape') {
      closeEditor();
    }
  }

  // ========== 分类管理 ==========
  function renderCategories() {
    const select = document.getElementById('edit-note-category');
    if (!select) return;

    select.innerHTML = '<option value="">无分类</option>' +
      categories.map(cat => `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`).join('');

    // 更新侧边栏分类（如果需要自定义分类显示）
  }

  function addCategory() {
    const name = prompt('输入分类名称：');
    if (!name) return;

    const icon = prompt('输入分类图标 (emoji)：', '📁');
    const id = 'cat_' + Date.now();

    categories.push({ id, name, icon: icon || '📁' });
    saveCategories();
    notify('分类已创建');
  }

  // ========== 笔记列表 ==========
  function renderNotesList() {
    const container = document.getElementById('notes-list');
    if (!container) return;

    let filtered = notes.filter(note => {
      // 分类过滤
      if (currentCategory === 'starred' && !note.starred) return false;
      if (currentCategory === 'archived' && !note.archived) return false;
      if (currentCategory === 'all' && note.archived) return false;

      // 搜索过滤
      if (currentFilter) {
        const text = `${note.title} ${note.content}`.toLowerCase();
        if (!text.includes(currentFilter)) return false;
      }

      return true;
    });

    // 排序
    const sortBy = document.getElementById('notes-sort')?.value || 'updated';
    filtered.sort((a, b) => {
      if (sortBy === 'created') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    // 更新计数
    updateCounts(filtered);

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><h3>没有找到笔记</h3><p>试试其他搜索词或创建新笔记。</p></div>';
      return;
    }

    container.innerHTML = filtered.map(note => {
      const excerpt = stripMarkdown(note.content).slice(0, 100);
      const timeLabel = formatRelativeTime(note.updatedAt);

      return `
        <div class="note-list-item ${currentNote && currentNote.id === note.id ? 'active' : ''}" data-id="${note.id}">
          <div class="note-list-item-header">
            <h3 class="note-list-title">${escapeHtml(note.title || '无标题')}</h3>
            ${note.starred ? '<span class="note-starred-icon">⭐</span>' : ''}
          </div>
          <div class="note-list-excerpt">${escapeHtml(excerpt)}${note.content.length > 100 ? '...' : ''}</div>
          <div class="note-list-meta">
            <span>${timeLabel}</span>
            <div class="note-list-tags">
              ${note.tags.slice(0, 3).map(tag => `<span class="note-list-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 绑定点击事件
    container.querySelectorAll('.note-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const note = notes.find(n => n.id === id);
        if (note) openNote(note);
      });
    });
  }

  function updateCounts() {
    const all = notes.filter(n => !n.archived).length;
    const starred = notes.filter(n => n.starred && !n.archived).length;
    const archived = notes.filter(n => n.archived).length;

    document.getElementById('count-all').textContent = all;
    document.getElementById('count-starred').textContent = starred;
    document.getElementById('count-archived').textContent = archived;
  }

  function renderSidebarTags() {
    const container = document.getElementById('sidebar-tags-list');
    if (!container) return;

    const tagCounts = {};
    notes.forEach(note => {
      if (note.archived) return;
      note.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const tags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    if (tags.length === 0) {
      container.innerHTML = '<p style="font-size:11px;color:var(--muted);padding:8px">暂无标签</p>';
      return;
    }

    container.innerHTML = tags.map(([tag, count]) =>
      `<button class="sidebar-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} (${count})</button>`
    ).join('');

    // 点击标签过滤
    container.querySelectorAll('.sidebar-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('notes-search').value = btn.dataset.tag;
        currentFilter = btn.dataset.tag.toLowerCase();
        renderNotesList();
      });
    });
  }

  // ========== 笔记编辑 ==========
  function createNewNote() {
    currentNote = {
      id: 'note_' + Date.now(),
      title: '',
      content: '',
      category: '',
      tags: [],
      starred: false,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    notes.unshift(currentNote);
    saveNotes();
    openNote(currentNote);
  }

  function openNote(note) {
    currentNote = note;

    document.getElementById('edit-note-title').value = note.title || '';
    document.getElementById('edit-note-content').value = note.content || '';
    document.getElementById('edit-note-category').value = note.category || '';
    document.getElementById('edit-note-tags').value = note.tags.join(', ');

    updateStarredButton();
    updateWordCount();
    updatePreview();

    document.getElementById('notes-editor').classList.remove('hidden');
    renderNotesList(); // 更新列表中的 active 状态
  }

  function closeEditor() {
    if (currentNote && hasUnsavedChanges()) {
      if (!confirm('有未保存的更改，确定要关闭吗？')) return;
    }

    document.getElementById('notes-editor').classList.add('hidden');
    currentNote = null;
    renderNotesList();
  }

  function saveCurrentNote() {
    if (!currentNote) return;

    currentNote.title = document.getElementById('edit-note-title').value.trim() || '无标题';
    currentNote.content = document.getElementById('edit-note-content').value;
    currentNote.category = document.getElementById('edit-note-category').value;
    currentNote.tags = document.getElementById('edit-note-tags').value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    currentNote.updatedAt = new Date().toISOString();

    saveNotes();
    renderSidebarTags();
    notify('笔记已保存');
    updateSaveTime();
  }

  function autoSave() {
    if (currentNote && hasUnsavedChanges()) {
      saveCurrentNote();
      console.log('Auto-saved note');
    }
  }

  function discardNote() {
    if (!currentNote) return;

    if (confirm('确定要删除这条笔记吗？')) {
      notes = notes.filter(n => n.id !== currentNote.id);
      saveNotes();
      closeEditor();
      notify('笔记已删除');
    }
  }

  function toggleStarred() {
    if (!currentNote) return;

    currentNote.starred = !currentNote.starred;
    currentNote.updatedAt = new Date().toISOString();
    saveNotes();
    updateStarredButton();
    notify(currentNote.starred ? '已加入收藏' : '已取消收藏');
  }

  function updateStarredButton() {
    const btn = document.getElementById('toggle-starred');
    if (btn && currentNote) {
      btn.textContent = currentNote.starred ? '★' : '☆';
      btn.style.color = currentNote.starred ? 'var(--orange)' : '';
    }
  }

  function hasUnsavedChanges() {
    if (!currentNote) return false;

    const title = document.getElementById('edit-note-title').value.trim() || '无标题';
    const content = document.getElementById('edit-note-content').value;
    const category = document.getElementById('edit-note-category').value;
    const tags = document.getElementById('edit-note-tags').value;

    return (
      title !== currentNote.title ||
      content !== currentNote.content ||
      category !== currentNote.category ||
      tags !== currentNote.tags.join(', ')
    );
  }

  // ========== 编辑器功能 ==========
  function switchEditorMode() {
    const editPane = document.getElementById('editor-edit-pane');
    const previewPane = document.getElementById('editor-preview-pane');
    const content = document.querySelector('.notes-editor-content');

    document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.editor-tab[data-tab="${editorMode}"]`)?.classList.add('active');

    if (editorMode === 'edit') {
      content.classList.remove('split-view');
      editPane.classList.remove('hidden');
      previewPane.classList.add('hidden');
    } else if (editorMode === 'preview') {
      content.classList.remove('split-view');
      editPane.classList.add('hidden');
      previewPane.classList.remove('hidden');
      updatePreview();
    } else if (editorMode === 'both') {
      content.classList.add('split-view');
      editPane.classList.remove('hidden');
      previewPane.classList.remove('hidden');
      updatePreview();
    }
  }

  function applyFormat(action) {
    const textarea = document.getElementById('edit-note-content');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);

    let newText = '';
    let cursorOffset = 0;

    switch (action) {
      case 'bold':
        newText = `**${selectedText || '粗体文本'}**`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'italic':
        newText = `*${selectedText || '斜体文本'}*`;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case 'heading':
        newText = `\n## ${selectedText || '标题'}\n`;
        cursorOffset = newText.length - 1;
        break;
      case 'list':
        newText = `\n- ${selectedText || '列表项'}\n`;
        cursorOffset = newText.length - 1;
        break;
      case 'code':
        if (selectedText.includes('\n')) {
          newText = `\n\`\`\`\n${selectedText || '代码块'}\n\`\`\`\n`;
        } else {
          newText = `\`${selectedText || '代码'}\``;
        }
        cursorOffset = newText.length - (selectedText ? 1 : 2);
        break;
      case 'link':
        newText = `[${selectedText || '链接文本'}](https://example.com)`;
        cursorOffset = newText.length - 1;
        break;
    }

    textarea.value = beforeText + newText + afterText;
    textarea.focus();
    textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);

    updateWordCount();
    if (editorMode === 'both') {
      updatePreview();
    }
  }

  function updatePreview() {
    const content = document.getElementById('edit-note-content')?.value || '';
    const preview = document.getElementById('preview-content');
    if (preview) {
      preview.innerHTML = renderMarkdown(content);
    }
  }

  function updateWordCount() {
    const content = document.getElementById('edit-note-content')?.value || '';
    const count = content.length;
    const wordCount = document.getElementById('note-word-count');
    if (wordCount) {
      wordCount.textContent = `${count} 字`;
    }
  }

  function updateSaveTime() {
    const timeEl = document.getElementById('note-update-time');
    if (timeEl) {
      timeEl.textContent = '刚刚保存';
    }
  }

  // ========== Markdown 渲染 ==========
  function renderMarkdown(text) {
    let html = escapeHtml(text);

    // 代码块
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 标题
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 粗体
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 斜体
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // 列表
    html = html.replace(/^\- (.*)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // 引用
    html = html.replace(/^&gt; (.*)$/gim, '<blockquote>$1</blockquote>');

    // 段落
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // 换行
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  function stripMarkdown(text) {
    return text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\- /gm, '')
      .replace(/^> /gm, '')
      .trim();
  }

  // ========== 统计 ==========
  function updateStats() {
    const total = notes.filter(n => !n.archived).length;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = notes.filter(n =>
      !n.archived && new Date(n.createdAt) >= weekAgo
    ).length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-week').textContent = weekCount;
  }

  // ========== 工具函数 ==========
  function toggleView() {
    // 预留：切换卡片/列表视图
    notify('视图切换功能开发中');
  }

  function formatRelativeTime(iso) {
    const date = new Date(iso);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
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

  // ========== 初始化 ==========
  document.addEventListener('DOMContentLoaded', () => {
    // 监听视图激活
    const observer = new MutationObserver(() => {
      const notesView = document.getElementById('view-notes');
      if (notesView && notesView.classList.contains('active')) {
        initNotesSystem();
        observer.disconnect(); // 只初始化一次
      }
    });

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      observer.observe(mainContent, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  });
})();
