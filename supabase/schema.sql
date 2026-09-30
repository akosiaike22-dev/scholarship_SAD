-- Run this file in Supabase SQL Editor before using the website.
-- GWA convention: lower is better (1.00 best, 5.00 worst); required_gwa is
-- the maximum acceptable value. Compliance requires gwa <= required_gwa.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'scholar' check (role in ('admin', 'staff', 'scholar'))
);

create table if not exists public.scholarship_programs (
  id uuid primary key default gen_random_uuid(),
  program_name text not null unique check (length(trim(program_name)) > 0),
  required_gwa numeric(3,2) not null check (required_gwa between 1.00 and 5.00),
  min_units integer not null check (min_units >= 0),
  allow_failing_grade boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.scholars (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique check (length(trim(student_id)) > 0),
  full_name text not null check (length(trim(full_name)) > 0),
  degree_program text not null check (length(trim(degree_program)) > 0),
  year_level integer not null check (year_level between 1 and 10),
  scholarship_id uuid not null references public.scholarship_programs(id),
  status text not null default 'Active' check (status in (
    'Active', 'Pending Submission', 'For Verification', 'Compliant',
    'With Deficiency', 'Probationary', 'For Renewal', 'Renewed', 'Disqualified'
  )),
  created_at timestamptz not null default now()
);

create table if not exists public.grade_submissions (
  id uuid primary key default gen_random_uuid(),
  scholar_id uuid not null references public.scholars(id) on delete cascade,
  academic_year text not null check (length(trim(academic_year)) > 0),
  semester text not null check (semester in ('1st Semester', '2nd Semester', 'Summer')),
  gwa numeric(3,2) not null check (gwa between 1.00 and 5.00),
  units_enrolled integer not null check (units_enrolled >= 0),
  failed_subjects integer not null default 0 check (failed_subjects >= 0),
  incomplete_subjects integer not null default 0 check (incomplete_subjects >= 0),
  submission_status text not null default 'Pending' check (submission_status in ('Pending', 'Verified', 'Returned')),
  submitted_at timestamptz not null default now(),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  compliance_result text check (compliance_result in ('Compliant', 'With Deficiency')),
  deficiency_reasons text[] not null default '{}',
  unique (scholar_id, academic_year, semester),
  check (
    (submission_status = 'Pending' and verified_by is null and verified_at is null and compliance_result is null)
    or (submission_status = 'Returned' and compliance_result is null)
    or (submission_status = 'Verified' and verified_by is not null and verified_at is not null and compliance_result is not null)
  )
);

create or replace function public.require_active_scholarship()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.scholarship_programs
    where id = new.scholarship_id and active = true
  ) then
    raise exception 'Select an active scholarship program.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists scholar_requires_active_program on public.scholars;
create trigger scholar_requires_active_program
before insert or update of scholarship_id on public.scholars
for each row execute function public.require_active_scholarship();

create index if not exists grade_submissions_status_idx on public.grade_submissions(submission_status);
create index if not exists grade_submissions_scholar_idx on public.grade_submissions(scholar_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'scholar')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('admin', 'staff'), false)
$$;

create or replace function public.verify_and_evaluate_submission(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.grade_submissions%rowtype;
  v_scholar public.scholars%rowtype;
  v_program public.scholarship_programs%rowtype;
  v_reasons text[] := '{}';
  v_result text;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Only staff or administrators may verify submissions.' using errcode = '42501';
  end if;

  select * into v_submission
  from public.grade_submissions
  where id = p_submission_id
  for update;
  if not found then
    raise exception 'Grade submission was not found.' using errcode = 'P0002';
  end if;
  if v_submission.submission_status <> 'Pending' then
    raise exception 'Only pending submissions can be verified.' using errcode = '22023';
  end if;

  select * into v_scholar from public.scholars where id = v_submission.scholar_id;
  select * into v_program from public.scholarship_programs where id = v_scholar.scholarship_id;
  if not found then
    raise exception 'The scholar must have an assigned scholarship program.' using errcode = '22023';
  end if;

  if v_submission.gwa > v_program.required_gwa then
    v_reasons := array_append(v_reasons, format('GWA %s is above the program maximum %s.', v_submission.gwa, v_program.required_gwa));
  end if;
  if v_submission.units_enrolled < v_program.min_units then
    v_reasons := array_append(v_reasons, format('Enrolled units %s are below the program minimum %s.', v_submission.units_enrolled, v_program.min_units));
  end if;
  if not v_program.allow_failing_grade and v_submission.failed_subjects > 0 then
    v_reasons := array_append(v_reasons, 'The program does not allow failing grades.');
  end if;
  if v_submission.incomplete_subjects > 0 then
    v_reasons := array_append(v_reasons, 'Incomplete subjects remain unresolved.');
  end if;

  v_result := case when cardinality(v_reasons) = 0 then 'Compliant' else 'With Deficiency' end;

  update public.grade_submissions
  set submission_status = 'Verified',
      verified_by = (select auth.uid()),
      verified_at = now(),
      compliance_result = v_result,
      deficiency_reasons = v_reasons
  where id = p_submission_id;

  update public.scholars set status = v_result where id = v_scholar.id;

  return jsonb_build_object('result', v_result, 'reasons', to_jsonb(v_reasons));
end;
$$;

create or replace function public.set_scholar_for_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.scholars set status = 'For Verification' where id = new.scholar_id;
  return new;
end;
$$;

drop trigger if exists grade_submission_pending_status on public.grade_submissions;
create trigger grade_submission_pending_status
after insert on public.grade_submissions
for each row execute function public.set_scholar_for_verification();

alter table public.profiles enable row level security;
alter table public.scholarship_programs enable row level security;
alter table public.scholars enable row level security;
alter table public.grade_submissions enable row level security;

drop policy if exists "Users read own profile or admins read all" on public.profiles;
create policy "Users read own profile or admins read all" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.current_app_role() = 'admin');

drop policy if exists "Staff manage scholarship programs" on public.scholarship_programs;
create policy "Staff manage scholarship programs" on public.scholarship_programs
for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists "Staff manage scholars" on public.scholars;
create policy "Staff manage scholars" on public.scholars
for all to authenticated using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

drop policy if exists "Staff read grade submissions" on public.grade_submissions;
create policy "Staff read grade submissions" on public.grade_submissions
for select to authenticated using (public.is_staff_or_admin());

drop policy if exists "Staff create grade submissions" on public.grade_submissions;
create policy "Staff create grade submissions" on public.grade_submissions
for insert to authenticated with check (public.is_staff_or_admin());

revoke all on public.profiles, public.scholarship_programs, public.scholars, public.grade_submissions from anon;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.scholarship_programs, public.scholars to authenticated;
grant select, insert on public.grade_submissions to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_staff_or_admin() to authenticated;
grant execute on function public.verify_and_evaluate_submission(uuid) to authenticated;

-- Bootstrap the first administrator after creating their account in Supabase Auth:
-- update public.profiles set role = 'admin', full_name = 'Your Name'
-- where id = (select id from auth.users where email = 'your-email@example.com');
