# 每日工作台

一个面向个人使用的工作记录和周报工具。支持本地离线使用，也支持接入 Supabase 后跨设备同步。

## 当前功能

- 按日期记录主题、详情、状态、工时、下一步、阻碍、项目和标签。
- 输入过程中自动保存草稿，刷新页面后可恢复未提交内容。
- 一键复制昨天记录，提供会议、开发、沟通、学习四种快捷模板。
- 历史记录搜索、按月份/项目筛选、编辑、软删除和最近删除恢复。
- 周报按周浏览；可选择任意日期范围并导出 Markdown、PDF、Excel。
- Excel 包含报告概览、每日明细、项目统计三张工作表。
- 浏览器通知提醒，可设置时间和是否跳过周末。
- PWA 离线缓存，可添加到手机主屏幕。

## 本地启动

```bash
npm install
npm run dev
```

访问终端显示的本地地址。生产构建使用 `npm run build`，输出在 `dist/`。

## 配置 Supabase 云同步

1. 在 Supabase Dashboard 的 SQL Editor 中运行 [`supabase/schema.sql`](supabase/schema.sql)。它会创建 `daily_entries`、`user_settings`、索引、更新时间触发器和 RLS 策略。
2. 在 Authentication → Providers → Google 启用 Google，并将 Supabase 回调地址填入 Google Cloud OAuth 设置。
3. 将正式站点加入 Supabase Authentication → URL Configuration 的 Site URL 和 Redirect URLs。
4. 复制 `config.example.js` 为 `config.js`，填入 Supabase Project URL 和 anon public key。`service_role` key 不能放进前端。
5. 重新构建并部署。

没有配置 Supabase 时，网站仍然可以完整使用本地保存、草稿、提醒和导出功能。

## 邮件提醒（可选）

[`supabase/functions/reminder/index.ts`](supabase/functions/reminder/index.ts) 是 Supabase Edge Function。部署时只在 Supabase secrets 中配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`REMINDER_FROM_EMAIL` 和可选的 `REMINDER_CRON_SECRET`。具体部署和 Cron 调用方式见 [`supabase/README.md`](supabase/README.md)。

## Vercel 部署

在项目根目录运行：

```bash
npx vercel --prod
```

首次运行会要求登录 Vercel。若使用 Vercel 环境变量，可在前端构建时注入 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，或直接维护 `config.js`（不要提交真实密钥到公开仓库）。
