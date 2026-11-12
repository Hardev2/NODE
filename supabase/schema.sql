-- Run this in the Supabase SQL editor.
-- Safe to run again. It adds folders if the first tables already exist.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.note_files (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at desc);

create index if not exists note_files_note_idx
  on public.note_files (note_id, created_at);

create table if not exists public.note_folders (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.note_folders (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists note_folders_note_idx
  on public.note_folders (note_id, parent_id);

alter table public.note_files
  add column if not exists folder_id uuid references public.note_folders (id) on delete cascade;

create index if not exists note_files_folder_idx
  on public.note_files (folder_id);

alter table public.notes enable row level security;
alter table public.note_files enable row level security;
alter table public.note_folders enable row level security;

-- These checks run as the table owner so a folder rule can look up
-- its parent without calling the same rule again.
create or replace function public.note_owned_by_me(target_note uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notes
    where id = target_note
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.folder_owned_by_me(target_folder uuid, target_note uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.note_folders
    where id = target_folder
      and note_id = target_note
      and user_id = (select auth.uid())
  );
$$;

revoke all on function public.note_owned_by_me(uuid) from PUBLIC, anon;
revoke all on function public.folder_owned_by_me(uuid, uuid) from PUBLIC, anon;
grant execute on function public.note_owned_by_me(uuid) to authenticated;
grant execute on function public.folder_owned_by_me(uuid, uuid) to authenticated;

drop policy if exists notes_select_own on public.notes;
drop policy if exists notes_insert_own on public.notes;
drop policy if exists notes_update_own on public.notes;
drop policy if exists notes_delete_own on public.notes;

create policy notes_select_own on public.notes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy notes_insert_own on public.notes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy notes_update_own on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy notes_delete_own on public.notes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists note_files_select_own on public.note_files;
drop policy if exists note_files_insert_own on public.note_files;
drop policy if exists note_files_update_own on public.note_files;
drop policy if exists note_files_delete_own on public.note_files;

create policy note_files_select_own on public.note_files
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy note_files_insert_own on public.note_files
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.note_owned_by_me(note_id)
    and (
      folder_id is null
      or public.folder_owned_by_me(folder_id, note_id)
    )
  );

drop policy if exists note_folders_select_own on public.note_folders;
drop policy if exists note_folders_insert_own on public.note_folders;
drop policy if exists note_folders_update_own on public.note_folders;
drop policy if exists note_folders_delete_own on public.note_folders;

create policy note_folders_select_own on public.note_folders
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy note_folders_insert_own on public.note_folders
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.note_owned_by_me(note_id)
    and (
      parent_id is null
      or public.folder_owned_by_me(parent_id, note_id)
    )
  );

create policy note_folders_update_own on public.note_folders
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy note_folders_delete_own on public.note_folders
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy note_files_update_own on public.note_files
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy note_files_delete_own on public.note_files
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.note_files to authenticated;
grant select, insert, update, delete on public.note_folders to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_touch_updated_at on public.notes;
create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_updated_at();

drop trigger if exists note_files_touch_updated_at on public.note_files;
create trigger note_files_touch_updated_at
  before update on public.note_files
  for each row execute function public.touch_updated_at();

drop trigger if exists note_folders_touch_updated_at on public.note_folders;
create trigger note_folders_touch_updated_at
  before update on public.note_folders
  for each row execute function public.touch_updated_at();
