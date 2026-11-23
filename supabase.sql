-- Gym&Juice database setup.
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin_hash text,                       -- null until the person picks their PIN
  created_at timestamptz not null default now()
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  day date not null,                   -- local gym day (Europe/Berlin)
  photo_path text,                     -- null once the photo is deleted after 90 days
  created_at timestamptz not null default now(),
  unique (person_id, day)              -- one check-in per person per day
);
create index if not exists checkins_day_idx on checkins (day);
create index if not exists checkins_created_idx on checkins (created_at desc);

create table if not exists reactions (
  checkin_id uuid not null references checkins(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  kind text not null check (kind in ('sus', 'love')),
  created_at timestamptz not null default now(),
  primary key (checkin_id, person_id, kind)
);

-- Lock everything down: the website talks to the database only through its
-- own server functions (which use the service role key), never directly.
alter table people enable row level security;
alter table checkins enable row level security;
alter table reactions enable row level security;

-- Newer Supabase projects don't grant table access to service_role automatically.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

-- Private bucket for gym photos.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- The crew.
insert into people (name) values
  ('Lumi'), ('Rroni'), ('Doka'), ('Vali'), ('Kllosha'), ('Ndero')
on conflict (name) do nothing;
