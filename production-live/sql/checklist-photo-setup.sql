-- Additive setup for Precision Production checklists and photo evidence.
-- No existing job data is deleted or modified.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('job-task-photos','job-task-photos',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false;

create table if not exists public.production_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (length(stage) between 1 and 100),
  task_key text not null check (task_key ~ '^[a-z0-9-]{1,100}$'),
  label text not null check (length(label) between 1 and 240),
  position integer not null default 0,
  is_required boolean not null default false,
  photo_required boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stage,task_key),
  constraint photo_requires_required_task check (not photo_required or is_required)
);
create index if not exists production_checklist_templates_stage on public.production_checklist_templates(stage,position);

create table if not exists public.production_checklist_completions (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  stage text not null,
  task_key text not null,
  completed_by uuid not null references public.profiles(id),
  completed_at timestamptz not null default now(),
  unique(job_id,stage,task_key),
  foreign key (stage,task_key) references public.production_checklist_templates(stage,task_key)
);
create index if not exists production_checklist_completions_job on public.production_checklist_completions(job_id,stage);

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
  constraint task_photo_storage_path check (
    split_part(storage_path,'/',1) = job_id and
    split_part(storage_path,'/',2) = task_key and
    split_part(storage_path,'/',3) <> '' and
    split_part(storage_path,'/',4) = ''
  )
);
create index if not exists job_task_photos_job_stage on public.job_task_photos(job_id,stage,created_at desc);

alter table public.production_checklist_templates enable row level security;
alter table public.production_checklist_completions enable row level security;
alter table public.job_task_photos enable row level security;
grant select, insert, update on public.production_checklist_templates to authenticated;
grant select, insert on public.production_checklist_completions to authenticated;
grant select, insert on public.job_task_photos to authenticated;

create policy "active staff read templates" on public.production_checklist_templates
for select to authenticated using (private.is_active_staff());
create policy "management create templates" on public.production_checklist_templates
for insert to authenticated with check (private.is_owner_or_manager());
create policy "management edit templates" on public.production_checklist_templates
for update to authenticated using (private.is_owner_or_manager())
with check (private.is_owner_or_manager());

create policy "active staff view completions" on public.production_checklist_completions
for select to authenticated using (private.is_active_staff());
create policy "active staff record completed checklist task" on public.production_checklist_completions
for insert to authenticated with check (
  private.is_active_staff() and completed_by=(select auth.uid())
  and exists (
    select 1 from public.production_checklist_templates t
    where t.stage=public.production_checklist_completions.stage and t.task_key=public.production_checklist_completions.task_key and t.active
  )
  and exists (
    select 1 from public.app_state a, jsonb_array_elements(coalesce(a.data->'jobs','[]'::jsonb)) j
    where a.id='main' and j->>'id'=job_id and coalesce(j->>'archivedAt','')=''
  )
);

create policy "active staff read photo records" on public.job_task_photos
for select to authenticated using (private.is_active_staff());
create policy "active staff record photo" on public.job_task_photos
for insert to authenticated with check (
  private.is_active_staff() and uploaded_by=(select auth.uid())
  and exists (
    select 1 from public.app_state a, jsonb_array_elements(coalesce(a.data->'jobs','[]'::jsonb)) j
    where a.id='main' and j->>'id'=job_id and coalesce(j->>'archivedAt','')=''
  )
  and (
    task_key='additional-photos'
    or exists (
      select 1 from public.production_checklist_templates t
      where t.stage=public.production_checklist_completions.stage and t.task_key=public.production_checklist_completions.task_key and t.active
    )
  )
  and exists (
    select 1 from storage.objects o
    where o.bucket_id='job-task-photos' and o.name=storage_path
  )
);

create policy "active staff read photo objects" on storage.objects
for select to authenticated
using (bucket_id='job-task-photos' and private.is_active_staff());
create policy "active staff upload photo objects" on storage.objects
for insert to authenticated
with check (
  bucket_id='job-task-photos'
  and private.is_active_staff()
  and split_part(name,'/',1) <> ''
  and split_part(name,'/',2) ~ '^[a-z0-9-]{1,100}$'
  and split_part(name,'/',3) ~ '^[0-9a-f-]+[.](jpg|png|webp)$'
  and split_part(name,'/',4)=''
  and exists (
    select 1 from public.app_state a, jsonb_array_elements(coalesce(a.data->'jobs','[]'::jsonb)) j
    where a.id='main' and j->>'id'=split_part(name,'/',1) and coalesce(j->>'archivedAt','')=''
  )
);

-- Default checklists are optional so existing production work remains unblocked.
insert into public.production_checklist_templates(stage,task_key,label,position,is_required,photo_required)
values
  ('Teardown','teardown-condition','Document engine condition before teardown',1,false,false),
  ('Cleaning & Blasting','cleaning-components','Document cleaned components',1,false,false),
  ('Inspection','inspection-cylinder','Inspect cylinder condition',1,false,false),
  ('Inspection','inspection-head','Inspect cylinder head',2,false,false),
  ('Inspection','inspection-crank','Inspect crankshaft',3,false,false),
  ('Machining','machining-work','Document machining work',1,false,false),
  ('Pull Parts for Build','parts-staged','Confirm parts pulled and staged',1,false,false),
  ('Mark','mark-assembly','Document assembly work',1,false,false),
  ('Steven','steven-assembly','Document assembly work',1,false,false),
  ('Test','test-stand','Document test stand results',1,false,false),
  ('VIN Verification','vin-serial','Verify VIN / serial number',1,false,false),
  ('Core Received - Inspection','core-condition','Document incoming core condition',1,false,false),
  ('Ready for Ship','shipping-package','Document packaging before shipment',1,false,false)
on conflict (stage,task_key) do nothing;
