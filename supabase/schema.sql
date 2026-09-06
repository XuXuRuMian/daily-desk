-- Daily Desk / Supabase database schema
-- Run this script in Supabase SQL Editor as a project owner.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text not null default '未命名记录',
  details text not null default '',
  hours numeric(5,2) not null default 0 check (hours >= 0 and hours <= 24),
  status text not null default 'progress' check (status in ('done', 'progress', 'pending')),
  next text not null default '',
  blocker text not null default '',
  project text not null default '',
  tags text[] not null default '{}'::text[],
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint daily_entries_user_date_key unique (user_id, date)
);

comment on table public.daily_entries is 'One work journal entry per user and calendar date.';
comment on column public.daily_entries.deleted_at is 'Soft-delete marker; null means the entry is active.';

create index if not exists daily_entries_user_date_idx
  on public.daily_entries (user_id, date desc);
create index if not exists daily_entries_user_updated_idx
  on public.daily_entries (user_id, updated_at desc);
create index if not exists daily_entries_tags_gin_idx
  on public.daily_entries using gin (tags);

drop trigger if exists daily_entries_set_updated_at on public.daily_entries;
create trigger daily_entries_set_updated_at
before update on public.daily_entries
for each row execute function public.set_updated_at();

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminder_enabled boolean not null default false,
  browser_reminders_enabled boolean not null default true,
  email_reminders_enabled boolean not null default false,
  reminder_time time not null default '18:00:00',
  timezone text not null default 'UTC',
  skip_weekends boolean not null default true,
  last_reminder_sent_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

-- New users get a settings row. The insert is intentionally minimal so users
-- can still change reminder preferences from the app later.
create or replace function public.handle_new_user_settings()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_settings on auth.users;
create trigger on_auth_user_created_settings
after insert on auth.users
for each row execute function public.handle_new_user_settings();

alter table public.daily_entries enable row level security;
alter table public.user_settings enable row level security;

-- PostgREST still requires table privileges in addition to RLS policies.
grant usage on schema public to anon, authenticated;
revoke all on public.daily_entries, public.user_settings from anon;
grant select, insert, update, delete on public.daily_entries to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;

drop policy if exists "Users can view their own entries" on public.daily_entries;
create policy "Users can view their own entries"
on public.daily_entries for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own entries" on public.daily_entries;
create policy "Users can insert their own entries"
on public.daily_entries for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own entries" on public.daily_entries;
create policy "Users can update their own entries"
on public.daily_entries for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own entries" on public.daily_entries;
create policy "Users can delete their own entries"
on public.daily_entries for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can view their own settings" on public.user_settings;
create policy "Users can view their own settings"
on public.user_settings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own settings" on public.user_settings;
create policy "Users can insert their own settings"
on public.user_settings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
on public.user_settings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own settings" on public.user_settings;
create policy "Users can delete their own settings"
on public.user_settings for delete
to authenticated
using (auth.uid() = user_id);
