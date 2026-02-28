alter table public.study_plans 
add column if not exists file_id text null,
add column if not exists file_name text null,
add column if not exists file_url text null;
