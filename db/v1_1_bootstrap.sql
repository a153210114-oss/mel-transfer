-- Huaban V1.1 independent database bootstrap.
-- Run this in the NEW V1.1 Supabase project/schema.
-- Do not run against the legacy Huaban database.

create extension if not exists pgcrypto;

create table if not exists hb_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  legacy_user_id text default '',
  legacy_friend_code text default '',
  phone_e164 text,
  email text,
  status text not null default 'active' check (status in ('active', 'blocked', 'deleted')),
  locale text not null default 'zh-CN',
  data_source text not null default 'v1_1',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone_e164),
  unique (tenant_id, legacy_friend_code)
);

create table if not exists hb_identity_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  user_id uuid not null references hb_users(id) on delete cascade,
  code text not null,
  code_kind text not null default 'personal' check (code_kind in ('personal', 'business', 'admin', 'supplier')),
  legacy_source_ref text default '',
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists hb_profiles (
  user_id uuid primary key references hb_users(id) on delete cascade,
  tenant_id text not null default 'hb_v1_1',
  display_name text not null default '',
  avatar_url text default '',
  city text not null default '',
  country text not null default 'Australia',
  bio text default '',
  industry text default '',
  languages text[] not null default array['zh-CN'],
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  user_id uuid not null references hb_users(id) on delete cascade,
  title text default '',
  industry_tags text[] not null default '{}'::text[],
  interest_tags text[] not null default '{}'::text[],
  visibility text not null default 'city' check (visibility in ('private', 'friends', 'city', 'public')),
  qr_payload text not null default '',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_referral_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  inviter_user_id uuid references hb_users(id) on delete set null,
  referee_user_id uuid references hb_users(id) on delete set null,
  inviter_code text not null default '',
  referee_code text not null default '',
  direct_referrer_code text default '',
  second_level_referrer_code text default '',
  referral_depth integer not null default 1,
  source text not null default 'qr_open',
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  legacy_referral_id text default '',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, inviter_code, referee_code)
);

create table if not exists hb_friendships (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  owner_id uuid not null references hb_users(id) on delete cascade,
  friend_id uuid not null references hb_users(id) on delete cascade,
  owner_code text not null default '',
  friend_code text not null default '',
  status text not null default 'active' check (status in ('pending', 'active', 'muted', 'blocked', 'deleted')),
  source text not null default 'card',
  legacy_friendship_id text default '',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, owner_id, friend_id),
  check (owner_id <> friend_id)
);

create table if not exists hb_friend_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  owner_id uuid not null references hb_users(id) on delete cascade,
  friend_id uuid not null references hb_users(id) on delete cascade,
  remark_name text default '',
  geo_group text not null default 'local' check (geo_group in ('local', 'remote_domestic', 'overseas')),
  tags text[] not null default '{}'::text[],
  private_note text default '',
  updated_at timestamptz not null default now(),
  unique (tenant_id, owner_id, friend_id)
);

create table if not exists hb_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  conversation_key text not null,
  sender_id uuid not null references hb_users(id) on delete cascade,
  receiver_id uuid not null references hb_users(id) on delete cascade,
  message_type text not null default 'text' check (message_type in ('text', 'voice', 'image', 'video', 'system')),
  body text default '',
  media_url text default '',
  delivery_status text not null default 'sent' check (delivery_status in ('sent', 'delivered', 'read', 'failed')),
  read_at timestamptz,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_dynamics (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  author_id uuid not null references hb_users(id) on delete cascade,
  city text not null default '',
  dynamic_type text not null default 'note' check (dynamic_type in ('note', 'video', 'question', 'notice')),
  media_type text not null default 'text' check (media_type in ('text', 'image', 'video')),
  content text not null default '',
  ai_summary text default '',
  tags text[] not null default '{}'::text[],
  status text not null default 'published' check (status in ('draft', 'published', 'hidden', 'removed')),
  data_source text not null default 'v1_1',
  legacy_post_id text default '',
  fields jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_dynamic_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  dynamic_id uuid not null references hb_dynamics(id) on delete cascade,
  user_id uuid not null references hb_users(id) on delete cascade,
  action_type text not null check (action_type in ('like', 'save', 'follow_author', 'comment')),
  comment_body text default '',
  created_at timestamptz not null default now(),
  unique (tenant_id, dynamic_id, user_id, action_type)
);

create table if not exists hb_point_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  user_id uuid references hb_users(id) on delete set null,
  owner_code text not null default '',
  event_key text not null,
  action text not null,
  points integer not null default 0,
  base_points integer not null default 0,
  status text not null default 'confirmed' check (status in ('pending_review', 'confirmed', 'rejected', 'reversed')),
  related_code text default '',
  ref_type text default '',
  ref_id uuid,
  direct_referrer_code text default '',
  second_level_referrer_code text default '',
  release_level text not null default 'L8',
  release_ratio text not null default '1/128',
  level_multiplier numeric(8,4) not null default 128,
  early_seat_multiplier numeric(8,4) not null default 1,
  risk_level text not null default 'normal',
  reason text default '',
  legacy_point_event_id text default '',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, event_key)
);

create table if not exists hb_user_growth_profiles (
  user_id uuid primary key references hb_users(id) on delete cascade,
  tenant_id text not null default 'hb_v1_1',
  points_balance integer not null default 0,
  release_level text not null default 'L8',
  release_ratio text not null default '1/128',
  level_multiplier numeric(8,4) not null default 128,
  contribution_score numeric(18,4) not null default 0,
  lifetime_distribution_usd numeric(18,2) not null default 0,
  cap_status text not null default 'open' check (cap_status in ('open', 'capped', 'returned')),
  updated_at timestamptz not null default now()
);

create table if not exists hb_supply_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  supplier_code text default '',
  linked_user_id uuid references hb_users(id) on delete set null,
  source_mode text not null default 'passive_user_entry',
  source_channel text not null default 'agent_supply_intake',
  name text not null default '',
  contact text default '',
  normalized_contact text default '',
  city text default '',
  country text default 'Australia',
  service_type text default '',
  service_type_code text default '',
  category text default '',
  language_lane text not null default 'unknown',
  service_area text default '',
  price_text text default '',
  availability text default '',
  intro text default '',
  qualification text default '',
  public_verification_url text default '',
  website text default '',
  verification_status text not null default 'pending_review',
  status text not null default 'candidate' check (status in ('candidate', 'pending_collection', 'pending_review', 'active', 'rejected', 'paused')),
  completeness_score integer not null default 0,
  legacy_supply_id text default '',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_supply_collection_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  task_date date not null default current_date,
  country text not null default 'Australia',
  city text not null default '',
  language_lane text not null default 'zh' check (language_lane in ('zh', 'en', 'mixed', 'unknown')),
  category_code text not null default '',
  category_name text not null default '',
  search_query text not null default '',
  source_name text not null default '',
  status text not null default 'queued' check (status in ('queued', 'assigned', 'collecting', 'captured', 'processed', 'reviewing', 'stored', 'failed', 'skipped')),
  priority integer not null default 3 check (priority between 1 and 5),
  capture_count integer not null default 0,
  extracted_count integer not null default 0,
  stored_count integer not null default 0,
  error_message text not null default '',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_demand_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  requester_user_id uuid references hb_users(id) on delete set null,
  requester_code text default '',
  requester_phone text default '',
  source_channel text default '',
  need_type text not null default 'local_service',
  service_type text default '',
  service_type_code text default '',
  city text default '',
  country text default 'Australia',
  area text default '',
  time_text text default '',
  budget_text text default '',
  urgency text not null default 'normal',
  raw_text text not null default '',
  summary text default '',
  missing_fields text[] not null default '{}'::text[],
  status text not null default 'human_review' check (status in ('draft', 'human_review', 'need_info', 'matching', 'matched', 'closed', 'cancelled')),
  supply_match_count integer not null default 0,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_ai_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  user_id uuid references hb_users(id) on delete set null,
  intent text not null default '',
  input_summary text default '',
  output_summary text default '',
  action_taken text default '',
  status text not null default 'ok' check (status in ('ok', 'failed', 'skipped')),
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  job_name text not null,
  ref_type text default '',
  ref_id uuid,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'needs_attention')),
  payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hb_site_content (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  page_key text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  version integer not null default 1,
  content jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, page_key, status)
);

create table if not exists hb_legacy_migration_map (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'hb_v1_1',
  legacy_table text not null,
  legacy_id text not null,
  new_table text not null,
  new_id uuid,
  migration_status text not null default 'mapped' check (migration_status in ('mapped', 'imported', 'skipped', 'failed')),
  note text default '',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, legacy_table, legacy_id, new_table)
);

create index if not exists idx_hb_users_tenant_status on hb_users(tenant_id, status, created_at desc);
create index if not exists idx_hb_identity_codes_user on hb_identity_codes(tenant_id, user_id);
create index if not exists idx_hb_referral_inviter on hb_referral_events(tenant_id, inviter_code, created_at desc);
create index if not exists idx_hb_referral_referee on hb_referral_events(tenant_id, referee_code, created_at desc);
create index if not exists idx_hb_friendships_owner on hb_friendships(tenant_id, owner_id, created_at desc);
create index if not exists idx_hb_friendships_codes on hb_friendships(tenant_id, owner_code, friend_code);
create index if not exists idx_hb_friend_notes_geo on hb_friend_notes(tenant_id, owner_id, geo_group);
create index if not exists idx_hb_messages_conversation on hb_messages(tenant_id, conversation_key, created_at desc);
create index if not exists idx_hb_dynamics_city_time on hb_dynamics(tenant_id, city, published_at desc);
create index if not exists idx_hb_dynamic_actions_lookup on hb_dynamic_actions(tenant_id, dynamic_id, action_type);
create index if not exists idx_hb_point_events_owner_time on hb_point_events(tenant_id, owner_code, created_at desc);
create index if not exists idx_hb_point_events_user_time on hb_point_events(tenant_id, user_id, created_at desc);
create index if not exists idx_hb_supply_city_type on hb_supply_profiles(tenant_id, city, service_type_code, status);
create index if not exists idx_hb_supply_contact on hb_supply_profiles(tenant_id, normalized_contact) where normalized_contact <> '';
create index if not exists idx_hb_supply_score on hb_supply_profiles(tenant_id, service_type_code, completeness_score desc);
create index if not exists idx_hb_supply_tasks_queue on hb_supply_collection_tasks(tenant_id, task_date, status, priority, created_at);
create index if not exists idx_hb_demand_lookup on hb_demand_cards(tenant_id, service_type_code, city, status, created_at desc);
create index if not exists idx_hb_ai_logs_time on hb_ai_logs(tenant_id, user_id, created_at desc);
create index if not exists idx_hb_jobs_status on hb_automation_jobs(tenant_id, status, created_at desc);
create index if not exists idx_hb_site_content_page on hb_site_content(tenant_id, page_key, status);

create or replace function hb_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_hb_users_updated_at on hb_users;
create trigger trg_hb_users_updated_at before update on hb_users for each row execute function hb_touch_updated_at();

drop trigger if exists trg_hb_profiles_updated_at on hb_profiles;
create trigger trg_hb_profiles_updated_at before update on hb_profiles for each row execute function hb_touch_updated_at();

drop trigger if exists trg_hb_cards_updated_at on hb_cards;
create trigger trg_hb_cards_updated_at before update on hb_cards for each row execute function hb_touch_updated_at();

drop trigger if exists trg_hb_friendships_updated_at on hb_friendships;
create trigger trg_hb_friendships_updated_at before update on hb_friendships for each row execute function hb_touch_updated_at();

drop trigger if exists trg_hb_dynamics_updated_at on hb_dynamics;
create trigger trg_hb_dynamics_updated_at before update on hb_dynamics for each row execute function hb_touch_updated_at();

drop trigger if exists trg_hb_supply_profiles_updated_at on hb_supply_profiles;
create trigger trg_hb_supply_profiles_updated_at before update on hb_supply_profiles for each row execute function hb_touch_updated_at();

drop trigger if exists trg_hb_supply_collection_tasks_updated_at on hb_supply_collection_tasks;
create trigger trg_hb_supply_collection_tasks_updated_at before update on hb_supply_collection_tasks for each row execute function hb_touch_updated_at();

drop trigger if exists trg_hb_demand_cards_updated_at on hb_demand_cards;
create trigger trg_hb_demand_cards_updated_at before update on hb_demand_cards for each row execute function hb_touch_updated_at();
