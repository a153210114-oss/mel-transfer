create table if not exists hb_users (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text unique,
  email text unique,
  status text not null default 'active' check (status in ('active', 'blocked', 'deleted')),
  locale text not null default 'zh-CN',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_identity_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  code text not null unique,
  code_kind text not null default 'personal' check (code_kind in ('personal', 'business', 'admin')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_hb_identity_codes_active_user_kind
  on hb_identity_codes(user_id, code_kind)
  where code_kind in ('personal', 'business');

create table if not exists hb_profiles (
  user_id uuid primary key references hb_users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  city text not null,
  country text not null default 'Australia',
  bio text,
  languages text[] not null default array['zh-CN'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_location_addresses (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('user_profile', 'city_post', 'supply_profile', 'demand_card', 'legacy_account')),
  entity_id uuid,
  legacy_entity_key text default '',
  owner_user_id uuid references hb_users(id) on delete set null,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  country text default '',
  state text default '',
  city text default '',
  suburb text default '',
  district text default '',
  street text default '',
  street_number text default '',
  postal_code text default '',
  formatted_address text default '',
  place_id text default '',
  google_maps_uri text default '',
  address_source text not null default 'coordinate_only' check (address_source in ('user_input', 'reverse_geocode', 'google_place', 'coordinate_only', 'admin_import')),
  precision_level text not null default 'coordinate' check (precision_level in ('country', 'state', 'city', 'suburb', 'street', 'premise', 'coordinate')),
  visibility_level text not null default 'city' check (visibility_level in ('private', 'friends', 'city', 'public', 'admin_only')),
  address_verified boolean not null default false,
  verification_status text not null default 'needs_user_confirmation' check (verification_status in ('needs_user_confirmation', 'confirmed_by_user', 'confirmed_by_admin', 'failed', 'not_required')),
  raw_components jsonb not null default '{}'::jsonb,
  fields jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, legacy_entity_key),
  unique (entity_type, entity_id)
);

create table if not exists hb_ai_companions (
  user_id uuid primary key references hb_users(id) on delete cascade,
  companion_name text not null default '小伴',
  avatar_url text,
  image_style text not null default 'huaban_default',
  liveliness text not null default 'lively' check (liveliness in ('quiet', 'natural', 'lively', 'very_lively')),
  tone text not null default 'warm_action',
  holiday_skin jsonb not null default '{}'::jsonb,
  review_status text not null default 'approved' check (review_status in ('draft', 'pending_review', 'approved', 'rejected')),
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  title text,
  industry_tags text[] not null default '{}',
  interest_tags text[] not null default '{}',
  visibility text not null default 'city' check (visibility in ('private', 'friends', 'city', 'public')),
  qr_payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references hb_users(id) on delete cascade,
  addressee_id uuid not null references hb_users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'muted', 'blocked')),
  source text not null default 'card',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table if not exists hb_referral_events (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid references hb_users(id) on delete set null,
  referee_user_id uuid references hb_users(id) on delete set null,
  inviter_code text not null,
  referee_code text not null,
  direct_referrer_code text default '',
  second_level_referrer_code text default '',
  referral_depth integer not null default 1 check (referral_depth in (1, 2)),
  source text not null default 'qr_open',
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  idempotency_key text not null,
  reason text default '',
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (inviter_code <> referee_code),
  unique (referee_code),
  unique (idempotency_key)
);

create table if not exists hb_friend_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references hb_users(id) on delete cascade,
  friend_id uuid not null references hb_users(id) on delete cascade,
  remark_name text,
  geo_group text not null default 'local' check (geo_group in ('local', 'remote_domestic', 'overseas')),
  tags text[] not null default '{}',
  source_note text,
  private_note text,
  updated_at timestamptz not null default now(),
  unique (owner_id, friend_id)
);

create table if not exists hb_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_key text not null,
  sender_id uuid not null references hb_users(id) on delete cascade,
  receiver_id uuid not null references hb_users(id) on delete cascade,
  message_type text not null default 'text' check (message_type in ('text', 'voice', 'image', 'system')),
  body text,
  media_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hb_city_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references hb_users(id) on delete cascade,
  city text not null,
  dynamic_type text not null default 'note' check (dynamic_type in ('note', 'video', 'question', 'notice')),
  media_type text not null default 'text' check (media_type in ('text', 'image', 'video')),
  content text not null,
  ai_summary text,
  tags text[] not null default '{}',
  status text not null default 'published' check (status in ('draft', 'published', 'hidden', 'removed')),
  moderation_status text not null default 'not_checked' check (moderation_status in ('not_checked', 'allowed', 'labeled', 'limited', 'pending_review', 'removed')),
  moderation_label text default '',
  age_gate_required boolean not null default false,
  audience_min_age integer,
  sensitive_reason text default '',
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references hb_city_posts(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists hb_post_actions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references hb_city_posts(id) on delete cascade,
  user_id uuid not null references hb_users(id) on delete cascade,
  action_type text not null check (action_type in ('like', 'save', 'follow_author', 'comment')),
  comment_body text,
  created_at timestamptz not null default now()
);

create table if not exists hb_points_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  owner_code text not null default '',
  event_key text not null,
  event_type text not null,
  points_delta integer not null,
  base_points integer not null default 0,
  growth_channel text not null default 'contribution' check (growth_channel in ('content', 'relationship', 'invitation', 'feedback', 'co_creation', 'contribution')),
  status text not null default 'confirmed' check (status in ('pending_review', 'confirmed', 'rejected', 'reversed')),
  related_code text default '',
  reason text,
  ref_type text,
  ref_id uuid,
  direct_referrer_code text default '',
  second_level_referrer_code text default '',
  release_level text not null default 'L8',
  release_ratio text not null default '1/128',
  level_multiplier numeric(8,4) not null default 128,
  early_seat_multiplier numeric(8,4) not null default 1,
  risk_level text not null default 'normal',
  created_at timestamptz not null default now(),
  unique (event_key)
);

create table if not exists hb_user_growth_profiles (
  user_id uuid primary key references hb_users(id) on delete cascade,
  points_balance integer not null default 0,
  public_growth_label text not null default 'new',
  contribution_score integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists hb_founder_system_accrual (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  founder_points integer not null default 0,
  release_level text not null,
  user_points_credited_total integer not null default 0,
  user_points_ratio numeric(8, 2) not null default 2.00,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_co_creation_tasks (
  id uuid primary key default gen_random_uuid(),
  task_title text not null,
  task_type text not null check (task_type in ('invite', 'content', 'feedback', 'city_ops', 'activity')),
  city text,
  points_reward integer not null default 0,
  level_required text not null default 'lv1_new_partner',
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  created_at timestamptz not null default now()
);

create table if not exists hb_ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id) on delete set null,
  intent text not null,
  input_mode text not null default 'text' check (input_mode in ('text', 'voice', 'tap', 'automation')),
  complexity text not null default 'single_action' check (complexity in ('single_action', 'multi_step_action', 'semantic_task', 'creative_generation', 'form_builder', 'automation_builder', 'review_required_action')),
  input_summary text,
  output_summary text,
  action_plan jsonb not null default '[]'::jsonb,
  requires_confirmation boolean not null default false,
  requires_moderation boolean not null default false,
  requires_authorization boolean not null default false,
  status text not null default 'ok' check (status in ('ok', 'failed', 'skipped')),
  created_at timestamptz not null default now()
);

create table if not exists hb_ai_intents (
  id uuid primary key default gen_random_uuid(),
  intent_key text not null unique,
  intent_name text not null,
  complexity text not null default 'single_action',
  description text default '',
  required_slots text[] not null default '{}',
  default_action_plan jsonb not null default '[]'::jsonb,
  safety_level text not null default 'normal' check (safety_level in ('normal', 'confirm', 'moderate', 'authorize', 'block')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_ai_action_catalog (
  id uuid primary key default gen_random_uuid(),
  action_key text not null unique,
  display_name text not null,
  page_key text not null default '',
  component_key text not null default '',
  action_type text not null default 'single_action',
  required_slots text[] not null default '{}',
  canonical_phrases text[] not null default '{}',
  aliases text[] not null default '{}',
  safety_level text not null default 'normal' check (safety_level in ('normal', 'confirm', 'moderate', 'authorize', 'block')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_ai_training_samples (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid references hb_ai_intents(id) on delete set null,
  action_key text default '',
  locale text not null default 'zh-CN',
  input_mode text not null default 'voice' check (input_mode in ('text', 'voice', 'tap')),
  training_level text not null default 'simple_prompt' check (training_level in ('function_key', 'simple_prompt', 'multi_expression', 'multi_action', 'semantic_understanding', 'generation_task')),
  raw_text text not null,
  normalized_text text default '',
  expected_intent text not null,
  expected_slots jsonb not null default '{}'::jsonb,
  expected_actions text[] not null default '{}',
  safety_expectations text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_ai_action_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id) on delete set null,
  ai_log_id uuid references hb_ai_logs(id) on delete set null,
  intent text not null,
  input_mode text not null default 'text',
  raw_text text default '',
  normalized_text text default '',
  confidence numeric(6, 4) not null default 0,
  slots jsonb not null default '{}'::jsonb,
  action_plan jsonb not null default '[]'::jsonb,
  execution_status text not null default 'planned' check (execution_status in ('planned', 'waiting_user_confirm', 'running', 'done', 'failed', 'cancelled', 'needs_review')),
  confirmation_status text not null default 'not_required' check (confirmation_status in ('not_required', 'pending', 'confirmed', 'rejected')),
  moderation_status text not null default 'not_required' check (moderation_status in ('not_required', 'pending', 'approved', 'rejected')),
  authorization_status text not null default 'not_required' check (authorization_status in ('not_required', 'pending', 'authorized', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  plan_name text not null,
  plan_level integer not null default 0,
  description text not null default '',
  ai_capabilities text[] not null default '{}',
  included_plugins text[] not null default '{}',
  pricing_mode text not null default 'reserved' check (pricing_mode in ('free', 'trial', 'subscription', 'quota', 'reserved')),
  status text not null default 'reserved' check (status in ('reserved', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  plan_key text not null,
  status text not null default 'trial' check (status in ('trial', 'active', 'paused', 'expired', 'revoked')),
  starts_at timestamptz,
  expires_at timestamptz,
  source text not null default 'manual_reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, plan_key, status)
);

create table if not exists hb_plugin_catalog (
  id uuid primary key default gen_random_uuid(),
  plugin_key text not null unique,
  plugin_name text not null,
  plugin_category text not null default 'ai',
  description text not null default '',
  pricing_mode text not null default 'reserved' check (pricing_mode in ('free', 'trial', 'subscription', 'quota', 'per_use', 'reserved')),
  unit_type text not null default 'action',
  base_quota integer,
  requires_moderation boolean not null default false,
  requires_authorization boolean not null default false,
  min_plan_key text not null default 'free',
  status text not null default 'reserved' check (status in ('reserved', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_user_plugin_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  plugin_key text not null,
  plan_key text not null default 'reserved',
  status text not null default 'trial' check (status in ('trial', 'active', 'paused', 'expired', 'revoked')),
  quota_total integer,
  quota_used integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  source text not null default 'manual_reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, plugin_key, plan_key)
);

create table if not exists hb_plugin_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id) on delete set null,
  plugin_key text not null,
  plan_key text not null default '',
  action_type text not null,
  units integer not null default 1,
  unit_type text not null default 'action',
  billable boolean not null default false,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'reversed', 'failed')),
  ref_type text not null default '',
  ref_id uuid,
  ai_action_run_id uuid references hb_ai_action_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists hb_release_versions (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique,
  version_name text not null,
  release_type text not null default 'feature_preview' check (release_type in ('security_patch', 'feature_preview', 'ui_refresh', 'paid_plugin', 'workflow_upgrade', 'deprecated_version')),
  summary text not null default '',
  ai_explanation text not null default '',
  status text not null default 'draft' check (status in ('draft', 'preview', 'active', 'paused', 'deprecated', 'archived')),
  rollout_policy text not null default 'optional' check (rollout_policy in ('optional', 'recommended', 'required')),
  target_scope jsonb not null default '{}'::jsonb,
  feature_keys text[] not null default '{}',
  plugin_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_release_videos (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references hb_release_versions(id) on delete cascade,
  video_url text not null,
  cover_url text,
  duration_seconds integer,
  title text not null default '',
  caption text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists hb_user_release_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hb_users(id) on delete cascade,
  release_key text not null,
  choice text not null check (choice in ('try_now', 'keep_current', 'remind_later', 'enable_plugin', 'rollback')),
  current_version_key text not null default '',
  target_version_key text not null default '',
  source text not null default 'message' check (source in ('message', 'settings', 'ai_chat', 'admin')),
  confirmation_text text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists hb_release_delivery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references hb_users(id) on delete set null,
  release_key text not null,
  channel text not null default 'message' check (channel in ('message', 'ai_chat', 'settings', 'push')),
  event_type text not null check (event_type in ('sent', 'delivered', 'opened', 'video_started', 'video_completed', 'choice_made')),
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  ref_type text,
  ref_id uuid,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'needs_attention')),
  payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hb_admin_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null unique,
  prompt_name text not null,
  scene text not null,
  body text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists hb_admin_review_queue (
  id uuid primary key default gen_random_uuid(),
  review_type text not null check (review_type in ('dynamic', 'comment', 'message_report', 'service_card', 'profile', 'ai_companion', 'automation_output', 'feedback', 'points_event')),
  ref_type text,
  ref_id uuid,
  actor_user_id uuid references hb_users(id) on delete set null,
  city text,
  title text not null,
  risk_category text not null default 'unknown',
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'critical')),
  risk_score numeric(6, 4) not null default 0,
  matched_rules text[] not null default '{}',
  suggested_action text not null default 'allow' check (suggested_action in ('allow', 'user_warning', 'sensitive_label', 'age_gate', 'limit_visibility', 'hold_for_review', 'remove_content', 'lock_feature', 'verify_identity', 'freeze_points', 'escalate_human')),
  final_action text,
  ai_reason text default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'actioned', 'appealed', 'reversed')),
  appeal_status text not null default 'none' check (appeal_status in ('none', 'open', 'under_review', 'accepted', 'rejected')),
  payload jsonb not null default '{}'::jsonb,
  reviewer_id uuid references hb_users(id) on delete set null,
  review_note text default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hb_moderation_events (
  id uuid primary key default gen_random_uuid(),
  ref_type text not null,
  ref_id uuid not null,
  actor_user_id uuid references hb_users(id) on delete set null,
  event_type text not null check (event_type in ('precheck', 'user_report', 'auto_scan', 'human_review', 'appeal', 'enforcement', 'rollback')),
  risk_category text not null default 'unknown',
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'critical')),
  action text not null default 'allow',
  source text not null default 'system',
  summary text default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hb_content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references hb_users(id) on delete set null,
  ref_type text not null,
  ref_id uuid not null,
  reason text not null,
  note text default '',
  status text not null default 'open' check (status in ('open', 'triaged', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references hb_admin_review_queue(id) on delete cascade,
  user_id uuid references hb_users(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'under_review', 'accepted', 'rejected')),
  result_note text default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hb_supply_profiles (
  id uuid primary key default gen_random_uuid(),
  supplier_code text default '',
  source_mode text not null default 'passive_user_entry',
  source_channel text not null default 'agent_supply_intake',
  name text not null default '',
  contact text default '',
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
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hb_supply_collection_tasks (
  id uuid primary key default gen_random_uuid(),
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

create table if not exists hb_supply_radar_state (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  decision text not null default 'idle',
  last_run_at timestamptz,
  last_skipped_reason text not null default '',
  cooldown_minutes integer not null default 240,
  run_chance numeric(4, 2) not null default 0.35,
  max_tasks integer not null default 3,
  per_task integer not null default 2,
  fields jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists hb_demand_cards (
  id uuid primary key default gen_random_uuid(),
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

create table if not exists hb_site_content (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  version integer not null default 1,
  content jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (page_key, status)
);

create table if not exists hb_site_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  page_key text,
  page_path text,
  ref_code text,
  channel text,
  campaign text,
  visitor_id text,
  device_type text,
  browser text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_hb_profiles_city on hb_profiles(city);
create index if not exists idx_hb_location_addresses_entity on hb_location_addresses(entity_type, entity_id);
create index if not exists idx_hb_location_addresses_legacy on hb_location_addresses(entity_type, legacy_entity_key);
create index if not exists idx_hb_location_addresses_city on hb_location_addresses(country, state, city, suburb);
create index if not exists idx_hb_location_addresses_coords on hb_location_addresses(latitude, longitude);
create index if not exists idx_hb_ai_companions_review on hb_ai_companions(review_status, updated_at desc);
create index if not exists idx_hb_cards_user_id on hb_cards(user_id);
create index if not exists idx_hb_friendships_requester on hb_friendships(requester_id);
create index if not exists idx_hb_friendships_addressee on hb_friendships(addressee_id);
create index if not exists idx_hb_referral_inviter on hb_referral_events(inviter_code, created_at desc);
create index if not exists idx_hb_referral_referee on hb_referral_events(referee_code, created_at desc);
create index if not exists idx_hb_friend_notes_geo_group on hb_friend_notes(owner_id, geo_group);
create index if not exists idx_hb_messages_conversation on hb_messages(conversation_key, created_at desc);
create index if not exists idx_hb_city_posts_city_time on hb_city_posts(city, published_at desc);
create index if not exists idx_hb_post_actions_post on hb_post_actions(post_id, action_type);
create index if not exists idx_hb_points_events_user_time on hb_points_events(user_id, created_at desc);
create index if not exists idx_hb_points_events_owner_time on hb_points_events(owner_code, created_at desc);
create index if not exists idx_hb_founder_system_accrual_user on hb_founder_system_accrual(user_id, release_level);
create index if not exists idx_hb_co_creation_tasks_city_status on hb_co_creation_tasks(city, status);
create index if not exists idx_hb_ai_logs_user_time on hb_ai_logs(user_id, created_at desc);
create index if not exists idx_hb_admin_prompts_status on hb_admin_prompts(status);
create index if not exists idx_hb_admin_review_queue_status on hb_admin_review_queue(status, city);
create index if not exists idx_hb_supply_profiles_city_type on hb_supply_profiles(city, service_type_code, status);
create index if not exists idx_hb_supply_profiles_score on hb_supply_profiles(service_type_code, completeness_score desc);
create index if not exists idx_hb_supply_collection_tasks_queue on hb_supply_collection_tasks(task_date, status, priority, created_at);
create index if not exists idx_hb_demand_cards_lookup on hb_demand_cards(service_type_code, city, status, created_at desc);
create index if not exists idx_hb_site_content_page on hb_site_content(page_key, status);
create index if not exists idx_hb_site_events_page on hb_site_events(page_key, created_at desc);
