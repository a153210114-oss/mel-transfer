-- Huaban v1.1 location address foundation.
-- Run this once in Supabase SQL Editor before reverse-geocoding legacy coordinates.

create table if not exists hb_location_addresses (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('user_profile', 'city_post', 'supply_profile', 'demand_card', 'legacy_account')),
  entity_id uuid,
  legacy_entity_key text default '',
  owner_user_id uuid,
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

create index if not exists idx_hb_location_addresses_entity
  on hb_location_addresses(entity_type, entity_id);

create index if not exists idx_hb_location_addresses_legacy
  on hb_location_addresses(entity_type, legacy_entity_key);

create index if not exists idx_hb_location_addresses_city
  on hb_location_addresses(country, state, city, suburb);

create index if not exists idx_hb_location_addresses_coords
  on hb_location_addresses(latitude, longitude);
