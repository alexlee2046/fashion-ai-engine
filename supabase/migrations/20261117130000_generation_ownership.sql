-- Database default also protects older app images during a staged rollout.
-- Preserve legacy rows without assigning owners: the old policies allowed users
-- to change campaign_id, so an existing link is not proof of ownership.
begin;

alter table public.generations
  add column user_id uuid references auth.users(id) on delete set null;

create index idx_generations_user_id on public.generations(user_id);

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
