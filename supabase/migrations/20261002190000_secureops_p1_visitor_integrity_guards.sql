-- SecureOps P1: database-level visitor integrity guards.
-- Prevent duplicate exits for the same visitor entry and duplicate active pass/vest numbers per property.

create unique index if not exists visitor_exits_entry_unique
  on public.visitor_exits(entry_id)
  where entry_id is not null;

create unique index if not exists visitor_entries_active_pass_unique
  on public.visitor_entries(property_id, lower(btrim(pass_vest_number)))
  where exit_id is null
    and pass_vest_number is not null
    and btrim(pass_vest_number) <> '';
