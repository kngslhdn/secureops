-- SECUREOPS V1: prevent duplicate emergency creation on client/network retries.
alter table public.emergency_incidents
  add column if not exists idempotency_key text;

create unique index if not exists emergency_incidents_idempotency_key_unique
  on public.emergency_incidents(idempotency_key)
  where idempotency_key is not null
    and btrim(idempotency_key) <> '';
