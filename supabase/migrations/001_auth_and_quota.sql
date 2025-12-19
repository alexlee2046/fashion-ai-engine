-- ============================================
-- Fashion AI Engine - 公测版迁移
-- 日期: 2025-12-20
-- 功能: 用户配额表 + RLS策略收紧
-- ============================================

-- 1. 创建用户配额表
create table if not exists public.user_quotas (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  script_count integer default 0,
  image_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- 每个用户每天一条记录
  unique(user_id, date)
);

-- 2. 创建索引
create index if not exists idx_user_quotas_user_date
  on public.user_quotas(user_id, date);

-- 3. 自动更新 updated_at
create trigger update_user_quotas_updated_at
  before update on public.user_quotas
  for each row execute function update_updated_at_column();

-- 4. 配额增加函数 (原子操作)
create or replace function increment_quota(
  p_user_id uuid,
  p_date date,
  p_type text
)
returns void as $$
begin
  insert into public.user_quotas (user_id, date, script_count, image_count)
  values (
    p_user_id,
    p_date,
    case when p_type = 'script' then 1 else 0 end,
    case when p_type = 'image' then 1 else 0 end
  )
  on conflict (user_id, date)
  do update set
    script_count = user_quotas.script_count + case when p_type = 'script' then 1 else 0 end,
    image_count = user_quotas.image_count + case when p_type = 'image' then 1 else 0 end,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- ============================================
-- 5. RLS 策略 - user_quotas
-- ============================================
alter table public.user_quotas enable row level security;

-- 用户只能查看自己的配额
create policy "Users can view own quotas"
  on public.user_quotas for select
  using (auth.uid() = user_id);

-- ============================================
-- 6. 删除旧的宽松 RLS 策略
-- ============================================
drop policy if exists "Allow anonymous insert for MVP" on public.campaigns;
drop policy if exists "Allow anonymous select for MVP" on public.campaigns;
drop policy if exists "Allow anonymous update for MVP" on public.campaigns;

drop policy if exists "Allow anonymous insert for MVP" on public.generations;
drop policy if exists "Allow anonymous select for MVP" on public.generations;
drop policy if exists "Allow anonymous update for MVP" on public.generations;

-- ============================================
-- 7. 新 RLS 策略 - campaigns (用户隔离)
-- ============================================
create policy "Users can insert own campaigns"
  on public.campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can view own campaigns"
  on public.campaigns for select
  using (auth.uid() = user_id);

create policy "Users can update own campaigns"
  on public.campaigns for update
  using (auth.uid() = user_id);

-- ============================================
-- 8. 新 RLS 策略 - generations (通过 campaign 或独立)
-- ============================================
-- 允许插入: 关联自己的 campaign 或独立生成 (campaign_id = null)
create policy "Users can insert own generations"
  on public.generations for insert
  with check (
    campaign_id is null
    or exists (
      select 1 from public.campaigns
      where id = campaign_id and user_id = auth.uid()
    )
  );

-- 允许查看: 关联自己的 campaign 或独立生成
create policy "Users can view own generations"
  on public.generations for select
  using (
    campaign_id is null
    or exists (
      select 1 from public.campaigns
      where id = campaign_id and user_id = auth.uid()
    )
  );

-- 允许更新: 关联自己的 campaign 或独立生成
create policy "Users can update own generations"
  on public.generations for update
  using (
    campaign_id is null
    or exists (
      select 1 from public.campaigns
      where id = campaign_id and user_id = auth.uid()
    )
  );

-- ============================================
-- 注意事项:
-- 1. 执行此迁移前确保已启用 Supabase Auth
-- 2. 执行后需要修改代码添加 user_id 到 campaigns 插入
-- 3. 独立的 generations (无 campaign) 暂时对所有认证用户可见
--    后续可添加 user_id 字段到 generations 表进一步隔离
-- ============================================
