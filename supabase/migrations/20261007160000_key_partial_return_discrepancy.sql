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
