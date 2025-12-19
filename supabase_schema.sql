-- ============================================
-- Fashion AI Engine - Database Schema
-- Version: 2.0 (Phase 1 - VTON Support)
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. Campaigns Table (营销活动)
-- ============================================
create table public.campaigns (
  id uuid not null default uuid_generate_v4() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  user_id uuid references auth.users(id),
  product_description text not null,
  platform text default 'douyin',
  script_data jsonb,
  status text default 'draft'
  -- status: draft | script_generated | image_generated | video_generated | completed
);

-- ============================================
-- 2. Generations Table (生成任务)
-- ============================================
create table public.generations (
  id uuid not null default uuid_generate_v4() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  type text not null,
  -- type: image_model | video_marketing
  status text default 'pending',
  -- status: pending | processing | completed | failed
  prompt_used text,
  result_url text,
  provider_id text,
  -- Phase 1: VTON 支持
  input_image_url text,
  model_params jsonb,
  error_message text,
  -- 进度追踪
  progress integer default 0,
  started_at timestamptz,
  completed_at timestamptz
);

-- ============================================
-- 3. 索引优化
-- ============================================
create index idx_campaigns_user_id on public.campaigns(user_id);
create index idx_campaigns_status on public.campaigns(status);
create index idx_generations_campaign_id on public.generations(campaign_id);
create index idx_generations_status on public.generations(status);
create index idx_generations_type on public.generations(type);

-- ============================================
-- 4. 自动更新 updated_at
-- ============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_campaigns_updated_at
  before update on public.campaigns
  for each row execute function update_updated_at_column();

create trigger update_generations_updated_at
  before update on public.generations
  for each row execute function update_updated_at_column();

-- ============================================
-- 5. Row Level Security (RLS)
-- ============================================
alter table public.campaigns enable row level security;
alter table public.generations enable row level security;

-- MVP 阶段：允许匿名插入（user_id 为空时）
-- 生产环境应该改为严格的用户隔离策略

-- Campaigns policies
create policy "Allow anonymous insert for MVP"
on public.campaigns for insert
with check (true);

create policy "Allow anonymous select for MVP"
on public.campaigns for select
using (true);

create policy "Allow anonymous update for MVP"
on public.campaigns for update
using (true);

-- Generations policies
create policy "Allow anonymous insert for MVP"
on public.generations for insert
with check (true);

create policy "Allow anonymous select for MVP"
on public.generations for select
using (true);

create policy "Allow anonymous update for MVP"
on public.generations for update
using (true);

-- ============================================
-- 6. Storage Bucket (图片存储)
-- ============================================
-- 在 Supabase Dashboard 中创建:
-- Bucket name: product-images
-- Public: true (for CDN access)
-- File size limit: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
