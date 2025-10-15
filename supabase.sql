-- Enable extensions required for UUID generation and cryptography helpers
create extension if not exists "pgcrypto" with schema public;
create extension if not exists "uuid-ossp" with schema public;

-- Shared trigger to keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Applicants captured from the public landing page
create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  ho_ten text not null,
  so_dien_thoai text,
  telegram text,
  nam_sinh integer not null check (nam_sinh between 1900 and extract(year from now())::integer),
  ly_do text,
  dong_y boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists applicants_set_updated_at on public.applicants;
create trigger applicants_set_updated_at
before update on public.applicants
for each row
execute function public.set_updated_at();

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  ho_ten text,
  so_dien_thoai text,
  telegram text,
  nam_sinh integer,
  status text not null default 'active' check (status in ('active', 'paused', 'dropped')),
  drop_reason text,
  start_date date not null default current_date,
  applicant_id uuid references public.applicants (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
before update on public.members
for each row
execute function public.set_updated_at();

create table if not exists public.zoom_links (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists zoom_links_set_updated_at on public.zoom_links;
create trigger zoom_links_set_updated_at
before update on public.zoom_links
for each row
execute function public.set_updated_at();

create table if not exists public.daily_zoom_links (
  id uuid primary key default gen_random_uuid(),
  zoom_link_id uuid not null references public.zoom_links (id) on delete cascade,
  scheduled_for date not null unique,
  telegram_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists daily_zoom_links_set_updated_at on public.daily_zoom_links;
create trigger daily_zoom_links_set_updated_at
before update on public.daily_zoom_links
for each row
execute function public.set_updated_at();

create table if not exists public.admin_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists admin_settings_set_updated_at on public.admin_settings;
create trigger admin_settings_set_updated_at
before update on public.admin_settings
for each row
execute function public.set_updated_at();

-- Activate Row Level Security so we can tailor access
alter table public.applicants enable row level security;
alter table public.members enable row level security;
alter table public.zoom_links enable row level security;
alter table public.daily_zoom_links enable row level security;
alter table public.admin_settings enable row level security;

-- Applicants policies -------------------------------------------------------
drop policy if exists "Allow anonymous applicant inserts" on public.applicants;
create policy "Allow anonymous applicant inserts"
on public.applicants
for insert
to anon
with check (true);

drop policy if exists "Allow applicant lookups for landing page" on public.applicants;
create policy "Allow applicant lookups for landing page"
on public.applicants
for select
to anon, authenticated
using (true);

drop policy if exists "Allow service role to manage applicants" on public.applicants;
create policy "Allow service role to manage applicants"
on public.applicants
for all
to service_role
using (true)
with check (true);

-- Members policies ---------------------------------------------------------
drop policy if exists "Allow public email lookups" on public.members;
create policy "Allow public email lookups"
on public.members
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public member inserts" on public.members;
create policy "Allow public member inserts"
on public.members
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow public member updates" on public.members;
create policy "Allow public member updates"
on public.members
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow service role to manage members" on public.members;
create policy "Allow service role to manage members"
on public.members
for all
to service_role
using (true)
with check (true);

drop policy if exists "Allow applicant status updates" on public.applicants;
create policy "Allow applicant status updates"
on public.applicants
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow zoom link reads" on public.zoom_links;
create policy "Allow zoom link reads"
on public.zoom_links
for select
to anon, authenticated
using (is_active);

drop policy if exists "Allow zoom link writes" on public.zoom_links;
create policy "Allow zoom link writes"
on public.zoom_links
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow zoom link updates" on public.zoom_links;
create policy "Allow zoom link updates"
on public.zoom_links
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow zoom link deletions" on public.zoom_links;
create policy "Allow zoom link deletions"
on public.zoom_links
for delete
to anon, authenticated
using (true);

drop policy if exists "Allow daily zoom link reads" on public.daily_zoom_links;
create policy "Allow daily zoom link reads"
on public.daily_zoom_links
for select
to anon, authenticated
using (true);

drop policy if exists "Allow daily zoom link writes" on public.daily_zoom_links;
create policy "Allow daily zoom link writes"
on public.daily_zoom_links
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow daily zoom link updates" on public.daily_zoom_links;
create policy "Allow daily zoom link updates"
on public.daily_zoom_links
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow admin settings reads" on public.admin_settings;
create policy "Allow admin settings reads"
on public.admin_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Allow admin settings writes" on public.admin_settings;
create policy "Allow admin settings writes"
on public.admin_settings
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow admin settings updates" on public.admin_settings;
create policy "Allow admin settings updates"
on public.admin_settings
for update
to anon, authenticated
using (true)
with check (true);

-- Gratitude journal entries -------------------------------------------------
create table if not exists public.gratitude_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  entry_date date not null,
  gratitude text not null,
  highlight text,
  intention text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gratitude_unique_per_day unique (member_id, entry_date)
);

drop trigger if exists gratitude_entries_set_updated_at on public.gratitude_entries;
create trigger gratitude_entries_set_updated_at
before update on public.gratitude_entries
for each row
execute function public.set_updated_at();

alter table public.gratitude_entries enable row level security;

drop policy if exists "Members manage their gratitude" on public.gratitude_entries;
create policy "Members manage their gratitude"
on public.gratitude_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = public.gratitude_entries.member_id
      and coalesce(m.email, '') = coalesce(auth.jwt()->>'email', '')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.id = public.gratitude_entries.member_id
      and coalesce(m.email, '') = coalesce(auth.jwt()->>'email', '')
  )
);

create index if not exists gratitude_entries_member_date_idx
  on public.gratitude_entries (member_id, entry_date);

-- Homework submissions ------------------------------------------------------
create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  submission_date date not null,
  lesson text not null,
  submission text not null,
  mentor_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homework_unique_per_day unique (member_id, submission_date)
);

drop trigger if exists homework_submissions_set_updated_at on public.homework_submissions;
create trigger homework_submissions_set_updated_at
before update on public.homework_submissions
for each row
execute function public.set_updated_at();

alter table public.homework_submissions enable row level security;

drop policy if exists "Members manage their homework" on public.homework_submissions;
create policy "Members manage their homework"
on public.homework_submissions
for all
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = public.homework_submissions.member_id
      and coalesce(m.email, '') = coalesce(auth.jwt()->>'email', '')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.id = public.homework_submissions.member_id
      and coalesce(m.email, '') = coalesce(auth.jwt()->>'email', '')
  )
);

create index if not exists homework_submissions_member_date_idx
  on public.homework_submissions (member_id, submission_date);

-- Progress tracking ---------------------------------------------------------
create table if not exists public.progress_updates (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  recorded_for date not null default current_date,
  weight numeric(5,2) not null,
  height numeric(5,2) not null,
  note text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint progress_unique_per_day unique (member_id, recorded_for)
);

drop trigger if exists progress_updates_set_updated_at on public.progress_updates;
create trigger progress_updates_set_updated_at
before update on public.progress_updates
for each row
execute function public.set_updated_at();

alter table public.progress_updates enable row level security;

drop policy if exists "Members manage their progress" on public.progress_updates;
create policy "Members manage their progress"
on public.progress_updates
for all
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = public.progress_updates.member_id
      and coalesce(m.email, '') = coalesce(auth.jwt()->>'email', '')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.id = public.progress_updates.member_id
      and coalesce(m.email, '') = coalesce(auth.jwt()->>'email', '')
  )
);

create index if not exists progress_updates_member_date_idx
  on public.progress_updates (member_id, recorded_for desc);

