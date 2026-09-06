# 部署指南

## 快速部署步骤

### 1. 创建 Supabase 项目

1. 访问 https://supabase.com 并登录
2. 点击 "New Project" 创建项目
3. 记录下项目的：
   - Project URL（格式：`https://xxx.supabase.co`）
   - anon public key（在 Settings → API → Project API keys）

### 2. 配置数据库

1. 在 Supabase Dashboard 打开 SQL Editor
2. 复制 `supabase/schema.sql` 的全部内容
3. 粘贴并执行，创建表和 RLS 策略

### 3. 启用 Google 登录

1. 在 Supabase Dashboard 进入 Authentication → Providers
2. 找到 Google，点击启用
3. 需要 Google OAuth 凭证：
   - 访问 https://console.cloud.google.com/
   - 创建或选择项目
   - 启用 Google+ API
   - 创建 OAuth 2.0 客户端 ID（应用类型：Web 应用）
   - 添加授权重定向 URI：`https://[你的项目ID].supabase.co/auth/v1/callback`
   - 复制客户端 ID 和密钥到 Supabase
4. 在 Supabase Authentication → URL Configuration 添加：
   - Site URL：你的正式域名（如 `https://daily.yourdomain.com`）
   - Redirect URLs：添加同样的域名

### 4. 配置项目

编辑 `config.js`，填入你的 Supabase 凭证：

```javascript
window.DAILY_DESK_CONFIG = {
  supabaseUrl: 'https://xxx.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

⚠️ **注意：** 
- 只使用 anon public key，不要放 service_role key
- 如果是私有仓库可以直接提交，公开仓库请使用环境变量

### 5. 本地测试

```bash
npm run dev
```

访问本地地址，测试：
- Google 登录/退出
- 创建记录并检查是否同步到 Supabase
- 导出功能（PDF、Excel、Markdown）
- 浏览器提醒

### 6. 部署到 Vercel

**方式 A：使用 Vercel CLI（推荐）**

```bash
# 首次部署
npx vercel --prod

# 后续更新
npx vercel --prod
```

**方式 B：连接 Git 仓库**

1. 将代码推送到 GitHub/GitLab/Bitbucket
2. 在 Vercel Dashboard 点击 "Import Project"
3. 选择你的仓库
4. 使用默认构建设置即可（Vite 会自动识别）
5. 如果使用环境变量，在 Vercel 项目设置中添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### 7. 配置邮件提醒（可选）

如果需要每日邮件提醒：

1. 注册 Resend 账号：https://resend.com
2. 获取 API Key
3. 部署 Supabase Edge Function：

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接到你的项目
supabase link --project-ref [你的项目ID]

# 设置密钥
supabase secrets set SUPABASE_URL=https://xxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=[service_role_key]
supabase secrets set RESEND_API_KEY=[resend_api_key]
supabase secrets set REMINDER_FROM_EMAIL=daily@yourdomain.com

# 部署函数
supabase functions deploy reminder
```

4. 在 Supabase Dashboard → Database → Functions → Edge Functions
5. 找到 `reminder` 函数，获取调用 URL
6. 设置 Cron 任务（使用 cron-job.org 或 GitHub Actions）每天调用该 URL

详细说明见 `supabase/README.md`

## 环境变量方式部署

如果不想在 `config.js` 中硬编码凭证，可以使用环境变量：

1. 修改 `config.js`：

```javascript
window.DAILY_DESK_CONFIG = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};
```

2. 在 Vercel 项目设置中添加环境变量
3. 本地测试时创建 `.env` 文件：

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 验证部署

部署完成后，测试以下功能：

- [ ] 访问正式网址，页面正常加载
- [ ] 点击"登录"，能跳转到 Google 登录
- [ ] 登录后创建一条记录
- [ ] 在 Supabase Dashboard 的 Table Editor 中查看 `daily_entries` 表，确认记录已保存
- [ ] 在另一台设备或浏览器登录同一账号，确认能看到之前的记录
- [ ] 测试导出功能（PDF、Excel、Markdown）
- [ ] 测试离线模式（断网后仍能填写，恢复后自动同步）
- [ ] 如果启用了邮件提醒，确认能收到提醒邮件

## 常见问题

### Google 登录后跳转到错误页面

检查 Supabase Authentication → URL Configuration 中的 Redirect URLs 是否包含你的正式域名。

### 数据无法同步

1. 检查浏览器控制台是否有错误
2. 确认 `config.js` 中的 URL 和 key 正确
3. 确认已在 Supabase 中运行了 `schema.sql`
4. 确认 RLS 策略已启用

### 构建失败

确保 `package.json` 中的依赖都已安装：
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### PWA 不工作

PWA 需要 HTTPS。Vercel 自动提供 HTTPS，但本地测试需要使用 `localhost` 或配置本地 HTTPS。

## 维护

### 更新代码

```bash
# 修改代码后
npm run build
npx vercel --prod
```

### 备份数据

在 Supabase Dashboard → Database → Backups 可以创建数据库备份。

### 监控

- Vercel 提供访问统计和错误日志
- Supabase 提供数据库查询统计
- 建议配置 Vercel Analytics 或 Google Analytics

## 成本估算

- **Supabase Free Tier**：500MB 数据库，50GB 传输/月（足够个人使用）
- **Vercel Free Tier**：100GB 带宽/月（足够个人使用）
- **Resend Free Tier**：100 封邮件/天（足够提醒使用）

所有服务的免费额度对个人使用完全够用。如果需要更多资源或商业使用，可以按需升级。
