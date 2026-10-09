create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_type text not null check (form_type in ('newsletter', 'fan-submission')),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 3 and 254),
  topic text,
  submission_type text,
  message text,
  consent boolean not null check (consent),
  owner_hash text not null check (owner_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  check (
    (form_type = 'newsletter'
      and topic is not null
      and topic in ('reviews', 'auto', 'waveform', 'everything')
      and submission_type is null
      and message is null)
    or
    (form_type = 'fan-submission'
      and topic is null
      and submission_type is not null
      and submission_type in ('setup', 'art', 'video', 'other')
      and message is not null
      and char_length(message) between 10 and 2000)
  )
);

alter table public.form_submissions enable row level security;
revoke all on table public.form_submissions from anon, authenticated;
grant select, insert, update, delete on table public.form_submissions to service_role;

create table if not exists public.form_rate_limits (
  owner_hash text primary key check (owner_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null check (request_count > 0)
);

alter table public.form_rate_limits enable row level security;
revoke all on table public.form_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.form_rate_limits to service_role;

create or replace function public.check_form_rate_limit(p_owner_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if p_owner_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid visitor key';
  end if;

  insert into public.form_rate_limits (owner_hash, window_started_at, request_count)
  values (p_owner_hash, now(), 1)
  on conflict (owner_hash) do update
  set
    request_count = case
      when public.form_rate_limits.window_started_at <= now() - interval '10 minutes' then 1
      else public.form_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.form_rate_limits.window_started_at <= now() - interval '10 minutes' then now()
      else public.form_rate_limits.window_started_at
    end
  returning request_count into current_count;

  return current_count <= 5;
end;
$$;

revoke all on function public.check_form_rate_limit(text) from public, anon, authenticated;
grant execute on function public.check_form_rate_limit(text) to service_role;

create table if not exists public.poll_votes (
  voter_hash text primary key check (voter_hash ~ '^[a-f0-9]{64}$'),
  choice text not null check (choice in ('A', 'B')),
  updated_at timestamptz not null default now()
);

alter table public.poll_votes enable row level security;
revoke all on table public.poll_votes from anon, authenticated;
grant select, insert, update, delete on table public.poll_votes to service_role;

create or replace function public.get_blind_test_poll()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'A', count(*) filter (where choice = 'A'),
    'B', count(*) filter (where choice = 'B')
  )
  from public.poll_votes;
$$;

revoke all on function public.get_blind_test_poll() from public, anon, authenticated;
grant execute on function public.get_blind_test_poll() to service_role;
