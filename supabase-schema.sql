create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_email text,
  package_id text,
  package_name text,
  price numeric,
  image_name text,
  image_path text,
  notes text,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  payment_status text not null default 'pending'
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

drop policy if exists "orders_service_role_only" on public.orders;
create policy "orders_service_role_only"
on public.orders
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- In Supabase Storage, create a private bucket named:
-- sp4rk-orders
--
-- Then set this Vercel environment variable:
-- SUPABASE_BUCKET=sp4rk-orders
