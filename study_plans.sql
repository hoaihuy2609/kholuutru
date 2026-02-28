create table public.study_plans (
  id uuid not null default uuid_generate_v4 (),
  student_phone text not null,
  task_name text not null,
  is_completed boolean not null default false,
  due_date date not null,
  exam_id text null,
  exam_title text null,
  color text not null default '#6B7CDB',
  created_at timestamp with time zone null default now(),
  constraint study_plans_pkey primary key (id),
  constraint study_plans_student_phone_fkey foreign key (student_phone) references students (phone) on update cascade on delete cascade
);

-- Enable RLS
alter table public.study_plans enable row level security;

-- Policy cho phép ai cũng có thể thêm (insert)
create policy "Enable insert for authenticated and anon users"
on "public"."study_plans"
as permissive
for insert
to public
with check (true);

-- Cho phép xem và select
create policy "Enable read access for all users"
on "public"."study_plans"
as permissive
for select
to public
using (true);

-- Cho phép update
create policy "Enable update access for all users"
on "public"."study_plans"
as permissive
for update
to public
using (true)
with check (true);

-- Cho phép delete
create policy "Enable delete access for all users"
on "public"."study_plans"
as permissive
for delete
to public
using (true);
