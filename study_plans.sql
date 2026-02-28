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

-- THIẾT LẬP BẢO MẬT (RLS)
-- Nới lỏng RLS để mọi request đều có thể CRUD (vì app check Auth = LocalStorage)
alter table public.study_plans enable row level security;

create policy "Cho phép tất cả select" on public.study_plans for select using (true);
create policy "Cho phép tất cả insert" on public.study_plans for insert with check (true);
create policy "Cho phép tất cả update" on public.study_plans for update using (true);
create policy "Cho phép tất cả delete" on public.study_plans for delete using (true);
