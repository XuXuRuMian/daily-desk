# 每日工作台部署步骤

## 🎯 当前状态

✅ 项目已构建完成  
✅ Git 仓库已初始化  
✅ 所有代码已提交  

## 📦 接下来的部署步骤

### 选项 1：通过 GitHub + Vercel（推荐，最简单）

**1. 创建 GitHub 仓库**

访问 https://github.com/new 创建新仓库，然后运行：

```bash
! git remote add origin https://github.com/你的用户名/仓库名.git
! git branch -M main
! git push -u origin main
```

**2. 连接 Vercel**

1. 访问 https://vercel.com/new
2. 选择 "Import Git Repository"
3. 选择你刚创建的仓库
4. 点击 "Deploy"（Vercel 会自动识别 Vite 项目）

完成！每次 push 到 GitHub 都会自动部署。

---

### 选项 2：直接使用 Vercel CLI

在终端运行：

```bash
! vercel login
```

选择登录方式（推荐 GitHub），然后：

```bash
! npx vercel --prod
```

---

## ⚙️ 部署后配置

### 1. 配置 Supabase（必须）

如果还没有 Supabase 项目：

1. 访问 https://supabase.com/dashboard
2. 创建新项目
3. 在 SQL Editor 运行 `supabase/schema.sql`
4. 在 Authentication → Providers 启用 Google
5. 获取 Project URL 和 anon key

### 2. 配置环境变量

在 Vercel 项目设置中添加：
- `VITE_SUPABASE_URL` = 你的 Supabase URL
- `VITE_SUPABASE_ANON_KEY` = 你的 anon key

或者直接编辑 `config.js` 文件。

### 3. 配置 Google OAuth

1. 访问 https://console.cloud.google.com
2. 创建 OAuth 2.0 客户端 ID
3. 添加授权重定向 URI：
   - `https://你的项目ID.supabase.co/auth/v1/callback`
4. 将客户端 ID 和密钥填入 Supabase

### 4. 更新 Supabase URL 配置

在 Supabase → Authentication → URL Configuration：
- Site URL：`https://你的域名.vercel.app`
- Redirect URLs：同上

---

## 🧪 测试清单

部署完成后测试：

- [ ] 访问网站，页面正常加载
- [ ] Google 登录功能
- [ ] 创建和编辑记录
- [ ] 数据同步（多设备）
- [ ] PDF/Excel 导出
- [ ] 浏览器提醒

---

## 📚 详细文档

更多信息请查看：
- `DEPLOYMENT.md` - 完整部署指南
- `README.md` - 项目说明
- `supabase/README.md` - 邮件提醒配置

---

## 🆘 需要帮助？

如果遇到问题，告诉我具体的错误信息，我会帮你解决。
