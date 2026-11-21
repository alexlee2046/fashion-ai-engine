-- Database default also protects older app images during a staged rollout.
-- Keep legacy rows with unknown owners intact but hidden from application roles.
begin;

alter table public.generations
  add column user_id uuid references auth.users(id) on delete set null;

update public.generations as generation
set user_id = campaign.user_id
from public.campaigns as campaign
where generation.campaign_id = campaign.id
  and campaign.user_id is not null;

alter table public.generations alter column user_id set default auth.uid();
alter table public.generations enable row level security;

drop policy if exists "Allow anonymous insert for MVP" on public.generations;
drop policy if exists "Allow anonymous select for MVP" on public.generations;
drop policy if exists "Allow anonymous update for MVP" on public.generations;
drop policy if exists "Users can insert own generations" on public.generations;
drop policy if exists "Users can view own generations" on public.generations;
drop policy if exists "Users can update own generations" on public.generations;

create policy "Users can view own generations"
  on public.generations for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own generations"
  on public.generations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (campaign_id is null or exists (
      select 1 from public.campaigns as campaign
      where campaign.id = generations.campaign_id
        and campaign.user_id = (select auth.uid())
    ))
  );

create policy "Users can update own generations"
  on public.generations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (campaign_id is null or exists (
      select 1 from public.campaigns as campaign
      where campaign.id = generations.campaign_id
        and campaign.user_id = (select auth.uid())
    ))
  );

commit;
