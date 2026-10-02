-- SECUREOPS V1 P0/P1 database integrity and least-privilege guards.
-- Production data was reconciled before applying these constraints.

create unique index if not exists visitor_exits_entry_unique
  on public.visitor_exits(entry_id)
  where entry_id is not null;

create unique index if not exists visitor_entries_active_pass_unique
  on public.visitor_entries(property_id, lower(btrim(pass_vest_number)))
  where exit_id is null
    and pass_vest_number is not null
    and btrim(pass_vest_number) <> '';

revoke all on function public.set_emergency_incident_id() from anon, authenticated;
