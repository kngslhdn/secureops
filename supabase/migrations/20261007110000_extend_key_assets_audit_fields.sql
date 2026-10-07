-- Extend Key Assets master data to preserve the August 2026 audit source fields.
alter table public.key_assets add column if not exists floor text;
alter table public.key_assets add column if not exists category text;
alter table public.key_assets add column if not exists remarks text;
alter table public.key_assets add column if not exists quantity_detail text;
alter table public.key_assets add column if not exists source_document text;

alter table public.key_assets drop constraint if exists key_assets_property_id_fkey;
alter table public.key_assets add constraint key_assets_property_id_fkey
  foreign key (property_id) references public.properties(id) on delete restrict;

alter table public.key_assets drop constraint if exists key_assets_key_number_key;
create unique index if not exists key_assets_property_key_number_key
  on public.key_assets(property_id, key_number);

create index if not exists key_assets_property_id_idx on public.key_assets(property_id);
create index if not exists key_assets_category_idx on public.key_assets(category);
create index if not exists key_assets_floor_idx on public.key_assets(floor);
