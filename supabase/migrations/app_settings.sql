-- ── app_settings: lưu cấu hình hệ thống dùng chung ─────────────────────────
-- Dùng cho: deadline kỳ thi theo khối lớp (và bất kỳ config toàn hệ thống nào về sau)
-- Key convention: exam_deadline_{grade}  (grade = 10 | 11 | 12)
-- Value: JSON string, ví dụ: { "date": "2026-05-11T08:00", "name": "Thi Cuối Kì" }

create table if not exists public.app_settings (
  key   text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- Cho phép mọi người đọc (học sinh không cần auth)
alter table public.app_settings enable row level security;

create policy "public_read_app_settings"
  on public.app_settings for select
  using (true);

-- Admin ghi thông qua RPC (xem bên dưới) — không cho phép INSERT/UPDATE trực tiếp từ anon
-- (Nếu project chưa có role admin riêng thì dùng RPC với secret check)

-- ── RPC: admin đặt/cập nhật một setting ──────────────────────────────────────
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

-- Chỉ admin (service_role) mới được gọi RPC này từ phía backend.
-- Từ frontend, ta sẽ bảo vệ bằng cách kiểm tra isAdmin trước khi gọi.
