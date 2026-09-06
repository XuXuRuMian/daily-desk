# Cloudflare Pages 部署指南

## 🚀 使用 Cloudflare Pages 部署每日工作台

Cloudflare Pages 提供：
- ✅ 全球 CDN 加速
- ✅ 无限带宽
- ✅ 自动 HTTPS
- ✅ 免费部署
- ✅ Git 集成自动部署

---

## 📝 部署步骤

### 方式 1：通过 GitHub 自动部署（推荐）

**1. 推送代码到 GitHub**

首先确保代码已推送：
```bash
git push origin main
```

如果遇到网络问题，可以尝试：
```bash
# 使用 SSH 方式
git remote set-url origin git@github.com:XuXuRuMian/daily-desk.git
git push origin main
```

**2. 登录 Cloudflare Pages**

访问：https://dash.cloudflare.com/
- 如果没有账号，注册一个（免费）
- 进入左侧菜单 "Workers & Pages"
- 点击 "Create application"
- 选择 "Pages" 标签
- 点击 "Connect to Git"

**3. 连接 GitHub 仓库**

- 授权 Cloudflare 访问你的 GitHub
- 选择 `XuXuRuMian/daily-desk` 仓库
- 点击 "Begin setup"

**4. 配置构建设置**

```
Project name: daily-desk (或自定义)
Production branch: main
Build command: npm run build
Build output directory: dist
```

环境变量（可选，如果使用 Supabase）：
```
VITE_SUPABASE_URL = 你的 Supabase URL
VITE_SUPABASE_ANON_KEY = 你的 Supabase anon key
```

**5. 部署**

- 点击 "Save and Deploy"
- 等待 1-2 分钟完成首次构建
- 完成后你会获得一个 `.pages.dev` 域名

**6. 自定义域名（可选）**

在项目设置中：
- 进入 "Custom domains"
- 点击 "Set up a custom domain"
- 输入你的域名（例如：daily.yourdomain.com）
- 按照提示添加 DNS 记录

---

### 方式 2：使用 Wrangler CLI 部署

**1. 安装 Wrangler**

```bash
npm install -g wrangler
```

**2. 登录 Cloudflare**

```bash
wrangler login
```

**3. 创建 Pages 项目**

```bash
wrangler pages project create daily-desk
```

**4. 构建并部署**

```bash
npm run build
wrangler pages deploy dist --project-name=daily-desk
```

---

### 方式 3：直接上传（无 Git）

**1. 构建项目**

```bash
npm run build
```

**2. 访问 Cloudflare Dashboard**

- 进入 "Workers & Pages"
- 点击 "Create application" → "Pages" → "Upload assets"
- 将 `dist` 文件夹拖拽上传
- 输入项目名称
- 点击 "Deploy site"

---

## ⚙️ 配置 Supabase

部署后，需要配置 Supabase：

**1. 更新回调 URL**

在 Supabase Dashboard：
- Authentication → URL Configuration
- Site URL: `https://你的域名.pages.dev`
- Redirect URLs: 添加同样的域名

**2. 配置环境变量**

在 Cloudflare Pages 项目设置中：
- 进入 "Settings" → "Environment variables"
- 添加：
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- 点击 "Save"
- 触发重新部署

或者直接修改 `config.js` 文件并重新推送。

---

## 🔧 Wrangler 配置文件

创建 `wrangler.toml`（可选）：

```toml
name = "daily-desk"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist"

[build]
command = "npm run build"

[build.upload]
format = "service-worker"
```

---

## 🌐 自定义域名配置

### 如果你有自己的域名：

**1. 在 Cloudflare Pages 添加域名**
- 项目设置 → Custom domains
- 添加你的域名

**2. 配置 DNS（如果域名在 Cloudflare）**
自动配置，无需手动操作

**3. 配置 DNS（如果域名在其他服务商）**
添加 CNAME 记录：
```
Type: CNAME
Name: daily (或 @)
Value: daily-desk.pages.dev
```

---

## 📊 性能优化

Cloudflare Pages 自动提供：
- ✅ 全球 CDN
- ✅ HTTP/2 和 HTTP/3
- ✅ Brotli 压缩
- ✅ 自动缓存优化

额外优化建议：
1. 启用 Cloudflare Analytics（免费）
2. 配置缓存规则
3. 使用 Cloudflare Images（如果需要）

---

## 🔄 自动部署

连接 GitHub 后：
- ✅ 每次 push 到 main 分支自动部署
- ✅ Pull Request 预览部署
- ✅ 部署历史和回滚功能

---

## 💰 费用对比

| 功能 | Cloudflare Pages | Vercel Free |
|------|-----------------|-------------|
| 带宽 | 无限 | 100GB/月 |
| 构建时间 | 500 次/月 | 6000 分钟/年 |
| 并发构建 | 1 个 | 1 个 |
| 自定义域名 | 无限 | 无限 |
| CDN | 全球 | 全球 |
| 价格 | 免费 | 免费 |

**Cloudflare Pages 的优势：**
- 🚀 无限带宽（Vercel 免费版只有 100GB）
- 🌍 更多全球节点
- 🔒 内置 DDoS 防护
- 💵 完全免费

---

## 🆘 常见问题

### Q: 构建失败怎么办？

检查构建日志：
- 确保 `package.json` 中有 `build` 脚本
- 确保所有依赖都在 `dependencies` 中
- Node 版本兼容（Cloudflare 默认 Node 16+）

### Q: 部署后页面空白？

1. 检查浏览器控制台错误
2. 确认构建输出目录是 `dist`
3. 检查 `config.js` 中的 Supabase 配置

### Q: Google 登录不工作？

更新 Supabase 和 Google OAuth 的回调 URL 为新域名。

### Q: 如何回滚到之前的版本？

在 Cloudflare Pages 项目中：
- 进入 "Deployments"
- 找到想要恢复的版本
- 点击 "Rollback to this deployment"

---

## 📱 部署完成后

访问你的网站：
```
https://daily-desk-xxx.pages.dev
```

或你的自定义域名：
```
https://daily.yourdomain.com
```

---

## 🎯 下一步

1. ✅ 配置 Supabase URL
2. ✅ 测试 Google 登录
3. ✅ 绑定自定义域名（可选）
4. ✅ 开始使用！

需要帮助？告诉我你在哪一步遇到问题！
