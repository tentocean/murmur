-- ============================================================
--  Murmur — database schema
--  รันไฟล์นี้ใน Supabase project ใหม่ (SQL Editor → New query → Run)
-- ============================================================

-- ---------- ตารางงาน ----------
create table if not exists murmur_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  title       text not null,
  ts          timestamptz,                 -- เวลาเตือน (null = ไม่มีเวลา)
  done        boolean not null default false,
  notified_at timestamptz,                 -- ตั้งเมื่อส่ง push แล้ว กันส่งซ้ำ
  created_at  timestamptz not null default now()
);

create index if not exists murmur_tasks_user_idx on murmur_tasks(user_id);
create index if not exists murmur_tasks_due_idx
  on murmur_tasks(ts) where done = false and notified_at is null;

alter table murmur_tasks enable row level security;

drop policy if exists "own tasks" on murmur_tasks;
create policy "own tasks" on murmur_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- ตาราง push subscription (1 เครื่อง = 1 แถว) ----------
create table if not exists murmur_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table murmur_push_subscriptions enable row level security;

drop policy if exists "own subs" on murmur_push_subscriptions;
create policy "own subs" on murmur_push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- (ทำหลัง deploy Edge Function) นัด cron เช็คทุก 1 นาที ----------
-- ต้องเปิด extension ก่อน: Dashboard → Database → Extensions → เปิด pg_cron และ pg_net
--
-- select cron.schedule(
--   'murmur-send-reminders',
--   '* * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.functions.supabase.co/send-reminders',
--     headers := jsonb_build_object(
--       'Content-Type','application/json',
--       'Authorization','Bearer <SUPABASE_ANON_OR_SERVICE_KEY>'
--     )
--   );
--   $$
-- );
