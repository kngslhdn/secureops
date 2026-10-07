-- Treat partial key returns as custody discrepancies.
-- Example: borrowed 6, returned 5 => DISCREPANCY with 1 outstanding.

create or replace view public.key_control_transactions as
select
  b.id as borrowing_id,
  s.submission_id,
  b.borrower_name,
  b.department,
  b.key_number,
  b.key_description,
  b.quantity as borrowed_quantity,
  coalesce(sum(r.quantity),0)::integer as returned_quantity,
  greatest(b.quantity-coalesce(sum(r.quantity),0),0)::integer as outstanding_quantity,
  max(r.returned_at) as last_returned_at,
  b.security_officer_name as issued_by_security,
  b.borrowed_at,
  b.expected_return_at,
  case
    when greatest(b.quantity-coalesce(sum(r.quantity),0),0)=0 then 'RETURNED'
    when coalesce(sum(r.quantity),0)>0 and greatest(b.quantity-coalesce(sum(r.quantity),0),0)>0 then 'DISCREPANCY'
    when now()>b.expected_return_at then 'OUTSTANDING'
    else 'BORROWED'
  end as status,
  (coalesce(sum(r.quantity),0)>0 and greatest(b.quantity-coalesce(sum(r.quantity),0),0)>0) as discrepancy,
  b.property_id
from public.key_borrowings b
join public.submissions s on s.id=b.submission_id
left join public.key_returns r on r.borrowing_id=b.id
group by b.id,s.submission_id,b.borrower_name,b.department,b.key_number,b.key_description,b.quantity,b.security_officer_name,b.borrowed_at,b.expected_return_at,b.property_id;

update public.key_returns
set discrepancy_qty = (quantity < borrowed_quantity)
where discrepancy_qty is distinct from (quantity < borrowed_quantity);


-- Resolution workflow for key quantity discrepancies.
create table if not exists public.key_discrepancy_resolutions (
  id uuid primary key default gen_random_uuid(),
  borrowing_id uuid not null unique references public.key_borrowings(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  resolution_type text not null check (resolution_type in ('KEY_UPDATED','BAST_PROCESSED')),
  resolution_note text,
  resolved_by uuid not null references auth.users(id) on delete restrict,
  resolved_by_name text,
  resolved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists key_discrepancy_resolutions_property_idx on public.key_discrepancy_resolutions(property_id);
create index if not exists key_discrepancy_resolutions_borrowing_idx on public.key_discrepancy_resolutions(borrowing_id);

alter table public.key_discrepancy_resolutions enable row level security;

drop policy if exists key_discrepancy_resolutions_admin_select on public.key_discrepancy_resolutions;
create policy key_discrepancy_resolutions_admin_select on public.key_discrepancy_resolutions
for select to authenticated using (
  exists (select 1 from public.admin_profiles ap
    where ap.user_id=auth.uid() and ap.active=true
      and ap.role in ('ADMIN','MANAGER','SUPERADMIN')
      and (ap.role='SUPERADMIN' or ap.property_id=key_discrepancy_resolutions.property_id))
);

drop policy if exists key_discrepancy_resolutions_admin_insert on public.key_discrepancy_resolutions;
create policy key_discrepancy_resolutions_admin_insert on public.key_discrepancy_resolutions
for insert to authenticated with check (
  exists (select 1 from public.admin_profiles ap
    where ap.user_id=auth.uid() and ap.active=true
      and ap.role in ('ADMIN','MANAGER','SUPERADMIN')
      and (ap.role='SUPERADMIN' or ap.property_id=key_discrepancy_resolutions.property_id))
);

create or replace view public.key_control_transactions as
select
  b.id as borrowing_id,
  s.submission_id,
  b.borrower_name,
  b.department,
  b.key_number,
  b.key_description,
  b.quantity as borrowed_quantity,
  coalesce(sum(r.quantity),0)::integer as returned_quantity,
  greatest(b.quantity-coalesce(sum(r.quantity),0),0)::integer as outstanding_quantity,
  max(r.returned_at) as last_returned_at,
  b.security_officer_name as issued_by_security,
  b.borrowed_at,
  b.expected_return_at,
  case
    when greatest(b.quantity-coalesce(sum(r.quantity),0),0)=0 then 'RETURNED'
    when coalesce(sum(r.quantity),0)>0 and greatest(b.quantity-coalesce(sum(r.quantity),0),0)>0 then 'DISCREPANCY'
    when now()>b.expected_return_at then 'OUTSTANDING'
    else 'BORROWED'
  end as status,
  (coalesce(sum(r.quantity),0)>0 and greatest(b.quantity-coalesce(sum(r.quantity),0),0)>0) as discrepancy,
  b.property_id,
  case when dr.id is null then false else true end as discrepancy_resolved,
  dr.id as discrepancy_resolution_id,
  dr.resolution_type as discrepancy_resolution_type,
  dr.resolution_note as discrepancy_resolution_note,
  dr.resolved_by as discrepancy_resolved_by,
  dr.resolved_by_name as discrepancy_resolved_by_name,
  dr.resolved_at as discrepancy_resolved_at
from public.key_borrowings b
join public.submissions s on s.id=b.submission_id
left join public.key_returns r on r.borrowing_id=b.id
left join public.key_discrepancy_resolutions dr on dr.borrowing_id=b.id
group by b.id,s.submission_id,b.borrower_name,b.department,b.key_number,b.key_description,b.quantity,b.security_officer_name,b.borrowed_at,b.expected_return_at,b.property_id,
dr.id,dr.resolution_type,dr.resolution_note,dr.resolved_by,dr.resolved_by_name,dr.resolved_at;

grant select on public.key_discrepancy_resolutions to authenticated;


-- Resolved discrepancies must not block a new borrowing.
create or replace function public.prevent_outstanding_key_borrowing_race()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  outstanding_exists boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(NEW.key_number,0));
  select exists(
    select 1
    from public.key_control_transactions
    where key_number = NEW.key_number
      and outstanding_quantity > 0
      and not coalesce(discrepancy_resolved,false)
  ) into outstanding_exists;
  if outstanding_exists then
    raise exception 'Key % is currently outstanding. Please return the outstanding key(s) before a new borrowing.', NEW.key_number
      using errcode='23514';
  end if;
  return NEW;
end;
$function$;
