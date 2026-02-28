create table public.exam_results (
  id uuid not null default uuid_generate_v4 (),
  student_phone text null,
  student_name text null,
  exam_id text not null,
  exam_title text null,
  score numeric not null,
  total_questions integer not null,
  correct_answers integer not null,
  submitted_at timestamp with time zone null default now(),
  grade integer null,
  constraint exam_results_pkey primary key (id),
  constraint exam_results_student_phone_fkey foreign key (student_phone) references students (phone) on update cascade on delete cascade
);

-- Enable RLS
alter table public.exam_results enable row level security;

-- Policy cho phép ai cũng có thể thêm (insert) bài giải của mình (hoặc có thể hạn chế bằng function backend, nhưng tuỳ vào setup cũ)
-- Hiện tại App gọi insert trực tiếp bằng public anon key, ta cho phép insert:
create policy "Enable insert for authenticated and anon users"
on "public"."exam_results"
as permissive
for insert
to public
with check (true);

-- Cho phép xem kết quả
create policy "Enable read access for all users"
on "public"."exam_results"
as permissive
for select
to public
using (true);
