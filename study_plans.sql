-- Copy và chạy đoạn mã này trong Supabase SQL Editor
-- Xóa bảng cũ và tạo lại bảng mới tối giản 100% chuẩn Notion (Chỉ 1 lần chạy)

drop table if exists public.study_plans cascade;

create table
  public.study_plans (
    id uuid not null default gen_random_uuid (),
    student_phone text not null,
    task_name text not null,
    is_completed boolean not null default false,
    due_date date not null,
    color text not null default '#6B7CDB'::text,
    created_at timestamp with time zone not null default now(),
    constraint study_plans_pkey primary key (id)
  ) tablespace pg_default;

-- Thiết lập bảo mật cho Học sinh
alter table public.study_plans enable row level security;

create policy "Học sinh có thể xem học phần của mình" on public.study_plans
for select using (student_phone = current_setting('request.jwt.claims')::json->>'phone');

create policy "Học sinh có thể tạo học phần" on public.study_plans
for insert with check (student_phone = current_setting('request.jwt.claims')::json->>'phone');

create policy "Học sinh có thể cập nhật học phần" on public.study_plans
for update using (student_phone = current_setting('request.jwt.claims')::json->>'phone');

create policy "Học sinh có thể xóa học phần" on public.study_plans
for delete using (student_phone = current_setting('request.jwt.claims')::json->>'phone');
