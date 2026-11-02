-- Precision Production: immutable photo evidence for a specific job, stage, and task.
-- Apply in the linked Supabase project before merging the frontend.
-- Job records currently live in app_state JSON, so job_id is text rather than an FK.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('job-task-photos', 'job-task-photos', false, 8388608,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create table if not exists public.job_task_photos (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  stage text not null,
  task_key text not null,
  task_label text not null,
  storage_path text not null unique,
  file_name text not null,
  byte_size bigint not null check (byte_size between 1 and 8388608),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint job_photo_path_matches_task check (
    split_part(storage_path,'/',1) = job_id
    and split_part(storage_path,'/',2) = task_key
    and split_part(storage_path,'/',3) <> ''
    and split_part(storage_path,'/',4) = ''
  )
);
create index if not exists job_task_photos_by_job_stage
  on public.job_task_photos(job_id,stage,created_at desc);
alter table public.job_task_photos enable row level security;
grant select,insert on public.job_task_photos to authenticated;

drop policy if exists "active staff view job task photos" on public.job_task_photos;
create policy "active staff view job task photos" on public.job_task_photos
for select to authenticated using (private.is_active_staff());

drop policy if exists "active staff record job task photos" on public.job_task_photos;
create policy "active staff record job task photos" on public.job_task_photos
for insert to authenticated with check (
  private.is_active_staff()
  and uploaded_by = (select auth.uid())
  and storage_path like job_id || '/' || task_key || '/%'
  and task_key ~ '^[a-z0-9-]+$'
  and exists (
    select 1 from public.app_state s
    cross join lateral jsonb_array_elements(coalesce(s.data->'jobs','[]'::jsonb)) job
    where s.id='main' and job->>'id'=job_id
  )
  and exists (
    select 1 from storage.objects o
    where o.bucket_id='job-task-photos' and o.name=storage_path
  )
);

-- Do not add UPDATE / DELETE policies: evidence is append-only for staff.
drop policy if exists "active staff view photo objects" on storage.objects;
create policy "active staff view photo objects" on storage.objects
for select to authenticated using (
  bucket_id='job-task-photos' and private.is_active_staff()
);

drop policy if exists "active staff upload photo objects" on storage.objects;
create policy "active staff upload photo objects" on storage.objects
for insert to authenticated with check (
  bucket_id='job-task-photos'
  and private.is_active_staff()
  and split_part(name,'/',1) <> ''
  and split_part(name,'/',2) ~ '^[a-z0-9-]+$'
  and split_part(name,'/',3) ~ '^[0-9a-f-]+\.(jpg|png|webp)$'
  and split_part(name,'/',4) = ''
  and exists (
    select 1 from public.app_state s
    cross join lateral jsonb_array_elements(coalesce(s.data->'jobs','[]'::jsonb)) job
    where s.id='main' and job->>'id'=split_part(name,'/',1)
  )
);
