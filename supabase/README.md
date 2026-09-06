# Supabase 配置说明

## 1. 创建表与安全策略

在 Supabase Dashboard → **SQL Editor** 中运行 [`schema.sql`](./schema.sql)。脚本会创建：

- `daily_entries`：每个用户每天一条记录，包含项目、标签、软删除字段和更新时间。
- `user_settings`：提醒开关、提醒时间、时区、周末策略和邮件提醒去重日期。
- Auth 用户触发器、更新时间触发器和 RLS 策略。

`daily_entries` 的 `(user_id, date)` 唯一约束防止同一天产生重复记录。前端只能使用 Supabase 的 **anon key**；`service_role` 只允许放在 Edge Function 的服务端密钥中。

如果项目中已经存在旧版同名表，请先导出备份并确认已有数据没有重复的 `(user_id, date)`；必要时先完成字段迁移，再运行约束和策略部分。

## 2. Google 登录

在 Authentication → Providers → Google 中启用 Google，并填写 Google Cloud OAuth Client ID/Secret。Authorized redirect URI 使用 Supabase 提供的回调地址：

`https://<project-ref>.supabase.co/auth/v1/callback`

将正式站点地址加入 Supabase Authentication → URL Configuration 的 Site URL 和 Redirect URLs。前端登录时使用 `supabase.auth.signInWithOAuth({ provider: 'google' })`。

## 3. 提醒 Edge Function（可选）

`functions/reminder/index.ts` 是一个可部署的 Deno Edge Function。它会按每个用户的时区，在配置的时间之后检查当天是否有记录；没有记录且启用邮件提醒时，通过 Resend 发送一封提醒，并写入 `last_reminder_sent_on` 防止重复发送。浏览器提醒仍应由前端 Notification API 负责。

安装 Supabase CLI 后，在项目根目录执行：

```bash
supabase functions deploy reminder --no-verify-jwt
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> RESEND_API_KEY=<resend-api-key> REMINDER_FROM_EMAIL="Daily Desk <reminders@your-domain.com>" REMINDER_CRON_SECRET=<random-secret>
```

`--no-verify-jwt` 适用于由定时任务调用的函数；函数本身使用 `service_role`，不要把地址或密钥暴露到浏览器。建议使用 Supabase Cron/pg_cron 或外部定时器每 5 分钟调用：

```text
POST https://<project-ref>.supabase.co/functions/v1/reminder
Authorization: Bearer <service-role-key>
x-cron-secret: <random-secret>
```

Resend 的发件域名必须先完成验证。若不设置 `RESEND_API_KEY`，函数仍可运行并返回未发送原因，便于先做 dry run。

## 4. 前端环境配置

将 Supabase Project URL 和 **anon public key** 填入根目录 `config.js`。不要填写 `service_role` key。当前静态页面仍使用本地存储；接入登录和读写同步需要前端后续调用 Supabase JS SDK。
