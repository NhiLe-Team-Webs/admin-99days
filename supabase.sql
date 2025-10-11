-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.applicants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT applicants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.daily_workouts (
  day_number integer NOT NULL,
  date_for_automation date NOT NULL UNIQUE,
  title text NOT NULL,
  yt_link text NOT NULL,
  is_test_day boolean NOT NULL DEFAULT false,
  quote text,
  CONSTRAINT daily_workouts_pkey PRIMARY KEY (day_number)
);
CREATE TABLE public.gratitude_logs (
  id bigint NOT NULL DEFAULT nextval('gratitude_logs_id_seq'::regclass),
  member_id uuid NOT NULL,
  log_date date NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gratitude_logs_pkey PRIMARY KEY (id),
  CONSTRAINT gratitude_logs_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id)
);
CREATE TABLE public.homework_submissions (
  id bigint NOT NULL DEFAULT nextval('homework_submissions_id_seq'::regclass),
  member_id uuid NOT NULL,
  day_number integer NOT NULL,
  submission_link text NOT NULL,
  submitted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT homework_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT homework_submissions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id),
  CONSTRAINT homework_submissions_day_number_fkey FOREIGN KEY (day_number) REFERENCES public.daily_workouts(day_number)
);
CREATE TABLE public.members (
  id uuid NOT NULL,
  email text UNIQUE,
  name text,
  status text NOT NULL DEFAULT 'active'::text,
  drop_reason text,
  start_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT members_pkey PRIMARY KEY (id),
  CONSTRAINT members_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.progress_tracking (
  id bigint NOT NULL DEFAULT nextval('progress_tracking_id_seq'::regclass),
  member_id uuid NOT NULL,
  week_number integer NOT NULL,
  weight numeric,
  height numeric,
  waist numeric,
  hips numeric,
  chest numeric,
  reported_at timestamp with time zone DEFAULT now(),
  CONSTRAINT progress_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT progress_tracking_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id)
);
CREATE TABLE public.settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (key)
);