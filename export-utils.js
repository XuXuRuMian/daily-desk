(function (global) {
  'use strict';

  // Shared export helpers. They are intentionally independent from the app state so
  // the UI can use the same implementation for weekly and arbitrary date ranges.
  function asDate(value) {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const parts = String(value || '').split('-').map(Number);
    return parts.length === 3 && parts.every(Number.isFinite)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : null;
  }
  function dateString(value) {
    const d = asDate(value) || new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function rangeEntries(entries, start, end) {
    const from = dateString(start), to = dateString(end || start);
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry && !entry.deleted && !entry.deletedAt && entry.date >= from && entry.date <= to)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  function statusLabel(status) {
    return status === 'done' ? '已完成' : status === 'todo' ? '待开始' : '进行中';
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }
  function downloadBlob(filename, data, type) {
    const blob = new Blob([data], { type: type || 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function markdown(entries, start, end, options) {
    const opts = Object.assign({ details: true, hours: true, followup: true }, options);
    const rows = rangeEntries(entries, start, end);
    const from = dateString(start), to = dateString(end || start);
    const hours = rows.reduce((sum, row) => sum + Number(row.hours || 0), 0);
    const lines = [`# 工作报告 · ${from} — ${to}`, '', '## 概览', `- 记录天数：${rows.length} 天`, `- 投入时长：${hours} 小时`, `- 完成事项：${rows.filter((row) => row.status === 'done').length} 项`, '', '## 每日进展'];
    rows.forEach((row) => {
      lines.push(`### ${row.date} · ${row.title || '未命名记录'}`);
      lines.push(`状态：${statusLabel(row.status)}`);
      if (opts.hours) lines.push(`投入：${Number(row.hours || 0)} 小时`);
      if (opts.details) lines.push('', row.details || '暂无详情');
      if (opts.followup) {
        lines.push('', `下一步：${row.next || '暂无'}`, `阻碍：${row.blocker || '暂无'}`);
      }
      lines.push('');
    });
    lines.push('## 需要跟进', rows.filter((row) => row.blocker).map((row) => `- ${row.blocker}`).join('\n') || '- 暂无');
    return lines.join('\n');
  }
  function toRows(entries, options) {
    const opts = Object.assign({ details: true, hours: true, followup: true }, options);
    return entries.map((row) => {
      const value = { 日期: row.date, 标题: row.title || '', 状态: statusLabel(row.status) };
      if (opts.hours) value.投入时长 = Number(row.hours || 0);
      if (opts.details) value.工作详情 = row.details || '';
      if (opts.followup) { value.下一步计划 = row.next || ''; value.遇到的阻碍 = row.blocker || ''; }
      if (row.project) value.项目 = row.project;
      if (row.tags) value.标签 = Array.isArray(row.tags) ? row.tags.join(', ') : row.tags;
      return value;
    });
  }
  function exportXlsx(entries, start, end, options) {
    const opts = Object.assign({ details: true, hours: true, followup: true }, options);
    const rows = rangeEntries(entries, start, end);
    const from = dateString(start), to = dateString(end || start);
    if (!global.XLSX || !global.XLSX.utils) {
      const headers = Object.keys(toRows(rows, opts)[0] || { 日期: '', 标题: '' });
      const csv = [headers.join(','), ...toRows(rows, opts).map((row) => headers.map((key) => `"${String(row[key] == null ? '' : row[key]).replace(/"/g, '""')}"`).join(','))].join('\n');
      downloadBlob(`工作报告-${from}-${to}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
      return false;
    }
    const book = global.XLSX.utils.book_new();
    const daily = toRows(rows, opts);
    const totalHours = rows.reduce((sum, row) => sum + Number(row.hours || 0), 0);
    const overview = [{ 日期范围: `${from} — ${to}`, 记录天数: rows.length, 投入时长: totalHours, 完成事项: rows.filter((row) => row.status === 'done').length, 进行中: rows.filter((row) => row.status === 'progress').length }];
    global.XLSX.utils.book_append_sheet(book, global.XLSX.utils.json_to_sheet(overview), '报告概览');
    global.XLSX.utils.book_append_sheet(book, global.XLSX.utils.json_to_sheet(daily), '每日明细');
    const projectMap = {};
    rows.forEach((row) => {
      const key = row.project || '未分类';
      if (!projectMap[key]) projectMap[key] = { 项目: key, 投入时长: 0, 记录天数: 0, 完成事项: 0 };
      projectMap[key].投入时长 += Number(row.hours || 0);
      projectMap[key].记录天数 += 1;
      if (row.status === 'done') projectMap[key].完成事项 += 1;
    });
    global.XLSX.utils.book_append_sheet(book, global.XLSX.utils.json_to_sheet(Object.values(projectMap)), '项目统计');
    const filename = opts.filename || `工作报告-${from}-${to}.xlsx`;
    global.XLSX.writeFile(book, filename);
    return true;
  }
  function exportPdf(entries, start, end, options) {
    const opts = Object.assign({ details: true, hours: true, followup: true }, options);
    const rows = rangeEntries(entries, start, end);
    const from = dateString(start), to = dateString(end || start);
    const totalHours = rows.reduce((sum, row) => sum + Number(row.hours || 0), 0);
    const body = rows.map((row) => `<article><h2>${esc(row.date)} · ${esc(row.title || '未命名记录')}</h2><p class="meta">${esc(statusLabel(row.status))}${opts.hours ? ` · ${Number(row.hours || 0)} 小时` : ''}</p>${opts.details ? `<p>${esc(row.details || '暂无详情').replace(/\n/g, '<br>')}</p>` : ''}${opts.followup ? `<p class="followup"><b>下一步：</b>${esc(row.next || '暂无')}　<b>阻碍：</b>${esc(row.blocker || '暂无')}</p>` : ''}</article>`).join('');
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>工作报告 ${from} — ${to}</title><style>body{font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;color:#202336;margin:32px;line-height:1.6}h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:16px 0 2px;border-bottom:1px solid #ddd;padding-bottom:4px}.meta{color:#68708a;font-size:12px;margin:0 0 6px}.summary{padding:12px;background:#f5f6fb;border-radius:8px;margin:16px 0}article{break-inside:avoid}.followup{font-size:12px;color:#4d536b}@media print{body{margin:14mm}button{display:none}}</style></head><body><h1>工作报告</h1><div>${from} — ${to}</div><div class="summary">记录天数：${rows.length} 天　投入时长：${totalHours} 小时　完成事项：${rows.filter((row) => row.status === 'done').length} 项</div>${body || '<p>该日期范围暂无记录。</p>'}</body></html>`;
    // Keep a live window handle so the caller can write the report and invoke print.
    const printWindow = global.open('', '_blank');
    if (!printWindow) return false;
    printWindow.document.write(html);
    printWindow.document.close();
    let printed = false;
    const print = () => { if (printed) return; printed = true; printWindow.focus(); printWindow.print(); };
    printWindow.onload = print;
    // document.write may complete before the load handler is attached in some browsers.
    setTimeout(print, 180);
    return true;
  }
  function exportAllXlsx(entries, options) {
    const rows = (Array.isArray(entries) ? entries : []).filter((entry) => entry && !entry.deleted && !entry.deletedAt && entry.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const start = rows.length ? rows[0].date : dateString(new Date());
    const end = rows.length ? rows[rows.length - 1].date : start;
    return exportXlsx(rows, start, end, options);
  }
  global.DailyDeskExports = { rangeEntries, markdown, exportXlsx, exportAllXlsx, exportPdf, dateString };
})(window);
