-- Dedicated machinist work queue; existing production jobs and inventory runs remain unchanged.
create table if not exists public.machinist_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id text,
  title text not null check (length(btrim(title)) between 2 and 180),
  details text not null default '' check (length(details) <= 4000),
  scheduled_date date not null default current_date,
  assigned_to uuid references public.profiles(id),
  priority text not null default 'Normal' check (priority in ('Normal','High','Warranty')),
  status text not null default 'Scheduled' check (status in ('Scheduled','In Progress','Blocked','Complete')),
  blocker_note text not null default '' check (length(blocker_note) <= 1000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists machinist_tasks_date_status on public.machinist_tasks (scheduled_date, status);
create index if not exists machinist_tasks_job on public.machinist_tasks (job_id);
create index if not exists machinist_tasks_assignee on public.machinist_tasks (assigned_to,scheduled_date);
alter table public.machinist_tasks enable row level security;
grant select,insert,update on public.machinist_tasks to authenticated;

create policy "active staff read machinist tasks" on public.machinist_tasks
for select to authenticated using ((select private.is_active_staff()));
create policy "manager creates machinist tasks" on public.machinist_tasks
for insert to authenticated with check (
 (select private.is_owner_or_manager()) and created_by=(select auth.uid())
 and (job_id is null or exists (
   select 1 from public.app_state a
   cross join lateral jsonb_array_elements(coalesce(a.data->'jobs','[]'::jsonb)) j
   where a.id='main' and j->>'id'=job_id and coalesce(j->>'archivedAt','')=''
 ))
);
create policy "manager edits machinist tasks" on public.machinist_tasks
for update to authenticated
using ((select private.is_owner_or_manager()))
with check (
 (select private.is_owner_or_manager())
 and (job_id is null or exists (
  select 1 from public.app_state a
  cross join lateral jsonb_array_elements(coalesce(a.data->'jobs','[]'::jsonb)) j
  where a.id='main' and j->>'id'=job_id
 ))
);

create table if not exists public.machinist_task_events (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.machinist_tasks(id),
 from_status text,
 to_status text not null,
 note text not null default '' check (length(note) <= 1000),
 actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index if not exists machinist_events_task on public.machinist_task_events(task_id,created_at);
alter table public.machinist_task_events enable row level security;
grant select on public.machinist_task_events to authenticated;
create policy "active staff read machinist task events" on public.machinist_task_events
for select to authenticated using ((select private.is_active_staff()));

-- Technician status changes are checked server-side, without granting staff arbitrary edits.
create or replace function public.set_machinist_task_status(
  p_task_id uuid,
  p_status text,
  p_blocker_note text default ''
)
returns public.machinist_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_task public.machinist_tasks%rowtype;
 v_updated public.machinist_tasks%rowtype;
 v_user uuid;
 v_manager boolean;
 v_note text;
begin
 v_user := (select auth.uid());
 if v_user is null or not (select private.is_active_staff()) then
   raise exception 'Active team access required';
 end if;
 if p_status not in ('Scheduled','In Progress','Blocked','Complete') then
   raise exception 'Invalid machining status';
 end if;
 v_note := btrim(coalesce(p_blocker_note,''));
 if length(v_note) > 1000 then raise exception 'Note is too long'; end if;
 if p_status='Blocked' and v_note='' then raise exception 'Enter a blocker explanation'; end if;
 select * into v_task from public.machinist_tasks where id=p_task_id for update;
 if not found then raise exception 'Machinist task not found'; end if;
 v_manager := (select private.is_owner_or_manager());
 if not v_manager and v_task.assigned_to is not null and v_task.assigned_to <> v_user then
   raise exception 'This task is assigned to someone else';
 end if;
 if not v_manager and v_task.status='Complete' then
   raise exception 'Only management can reopen completed work';
 end if;
 if v_task.status=p_status then return v_task; end if;
 update public.machinist_tasks
 set status=p_status,
     blocker_note=case when p_status='Blocked' then v_note else '' end,
     started_at=case when p_status='In Progress' then coalesce(started_at,now()) else started_at end,
     completed_at=case when p_status='Complete' then now() else null end,
     updated_at=now()
 where id=p_task_id
 returning * into v_updated;
 insert into public.machinist_task_events(task_id,from_status,to_status,note,actor_id)
 values(p_task_id,v_task.status,p_status,v_note,v_user);
 return v_updated;
end
$$;
revoke all on function public.set_machinist_task_status(uuid,text,text) from public,anon;
grant execute on function public.set_machinist_task_status(uuid,text,text) to authenticated;
