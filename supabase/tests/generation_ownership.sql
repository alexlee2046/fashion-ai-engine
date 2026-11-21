\set ON_ERROR_STOP on
-- Run only in a disposable, empty PostgreSQL database.
create role authenticated;
create role anon;
create schema auth;
create table auth.users (id uuid primary key);
-- Model Supabase's request JWT subject without a dependency on the Auth service.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

\ir ../../supabase_schema.sql
\ir ../migrations/001_auth_and_quota.sql

insert into auth.users values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
insert into public.campaigns (id, user_id, product_description) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'A'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'B');
insert into public.generations (campaign_id, type) values
  ('10000000-0000-0000-0000-000000000001', 'legacy-linked'),
  (null, 'legacy-unassigned');

\ir ../migrations/20261117130000_generation_ownership.sql

grant usage on schema auth to authenticated, anon;
grant select on public.campaigns to authenticated, anon;
grant select, insert, update on public.generations to authenticated, anon;

do $$
begin
  if not exists (select 1 from public.generations where type = 'legacy-unassigned' and user_id is null) then
    raise exception 'Unassigned legacy row must be retained without guessing its owner';
  end if;
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare owner_id uuid;
begin
  if (select array_agg(type order by type) from public.generations)
    is distinct from array['legacy-linked'] then
    raise exception 'Backfilled row must be visible to its owner only';
  end if;

  insert into public.generations (type) values ('standalone') returning user_id into owner_id;
  if owner_id is distinct from auth.uid() then
    raise exception 'New standalone row must default to current user';
  end if;

  insert into public.generations (campaign_id, type)
  values ('10000000-0000-0000-0000-000000000001', 'new-linked');
  update public.generations set status = 'completed' where type = 'standalone';
  if not found then raise exception 'Owner cannot update their standalone row'; end if;

  begin
    insert into public.generations (type, user_id)
    values ('spoofed', '00000000-0000-0000-0000-000000000002');
    raise exception 'Spoofed user_id accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.generations set user_id = '00000000-0000-0000-0000-000000000002'
    where type = 'standalone';
    raise exception 'Owner reassignment accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
begin
  if exists (select 1 from public.generations) then
    raise exception 'Other user can read generations';
  end if;
  update public.generations set status = 'failed';
  if found then raise exception 'Other user can update generations'; end if;

  begin
    insert into public.generations (campaign_id, type)
    values ('10000000-0000-0000-0000-000000000001', 'wrong-campaign');
    raise exception 'Insert into another user''s campaign accepted';
  exception when insufficient_privilege then null;
  end;

  insert into public.generations (type) values ('other-owner');
  begin
    update public.generations set campaign_id = '10000000-0000-0000-0000-000000000001'
    where type = 'other-owner';
    raise exception 'Relinking to another user''s campaign accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
reset request.jwt.claim.sub;
set role anon;
do $$
begin
  if exists (select 1 from public.generations) then
    raise exception 'Anonymous read accepted';
  end if;

  begin
    insert into public.generations (type) values ('anonymous');
    raise exception 'Anonymous insert accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
