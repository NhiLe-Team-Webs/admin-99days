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

-- Activate Row Level Security so we can tailor access
alter table public.applicants enable row level security;
alter table public.members enable row level security;

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
