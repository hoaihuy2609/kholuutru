-- ── app_settings: lưu cấu hình hệ thống dùng chung ─────────────────────────
-- Key convention: exam_deadline_{grade}  (grade = 10 | 11 | 12)
-- Value: JSON string, ví dụ: { "date": "2026-05-11T08:00", "name": "Thi Cuối Kì" }
-- Lưu ý: đọc/ghi đều qua RPC (không query table trực tiếp) để tránh lỗi
--         PostgREST với cột tên 'key' (reserved keyword).

create table if not exists public.app_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- DROP trước khi CREATE để tránh lỗi "already exists" khi chạy lại
drop policy if exists "public_read_app_settings" on public.app_settings;
create policy "public_read_app_settings"
  on public.app_settings for select
  using (true);

-- ── RPC: READ ─────────────────────────────────────────────────────────────────
-- security definer để bypass RLS + tránh lỗi 400 từ REST API
create or replace function public.get_app_setting(p_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value text;
begin
  select value into v_value
  from public.app_settings
  where key = p_key;
  return v_value;
end;
$$;

grant execute on function public.get_app_setting(text) to anon;
grant execute on function public.get_app_setting(text) to authenticated;

-- ── RPC: WRITE ────────────────────────────────────────────────────────────────
create or replace function public.admin_upsert_app_setting(
  p_key   text,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_settings (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key)
  do update set value = excluded.value, updated_at = now();
end;
$$;

grant execute on function public.admin_upsert_app_setting(text, text) to anon;
grant execute on function public.admin_upsert_app_setting(text, text) to authenticated;
