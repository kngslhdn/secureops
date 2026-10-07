create or replace function public.distribute_package(
  p_package_registration_id uuid,
  p_recipient_name text,
  p_security_hand_over text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile record;
  v_pkg record;
  v_distribution public.package_distributions%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Unauthorized';
  end if;

  select ap.user_id, ap.role, ap.active, ap.property_id
    into v_profile
  from public.admin_profiles ap
  where ap.user_id = v_uid
    and ap.active = true
  limit 1;

  if not found or v_profile.role::text not in ('ADMIN','MANAGER','SUPERADMIN') then
    raise exception using errcode = '42501', message = 'Forbidden';
  end if;

  if nullif(trim(coalesce(p_recipient_name,'')), '') is null then
    raise exception using errcode = '22023', message = 'Please enter Recipient / Representative Name.';
  end if;

  if nullif(trim(coalesce(p_security_hand_over,'')), '') is null then
    raise exception using errcode = '22023', message = 'Please enter Security Hand Over.';
  end if;

  select pr.id, pr.submission_id, pr.recipient_name, pr.property_id
    into v_pkg
  from public.package_registrations pr
  where pr.id = p_package_registration_id
    and (v_profile.role::text = 'SUPERADMIN' or pr.property_id = v_profile.property_id)
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Package not found.';
  end if;

  if exists (
    select 1
    from public.package_distributions pd
    where pd.package_registration_id = v_pkg.id
  ) then
    raise exception using errcode = '23505', message = 'Package has already been distributed.';
  end if;

  select s.submission_id
    into v_pkg
  from public.submissions s
  where s.id = v_pkg.submission_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Package submission record not found.';
  end if;

  begin
    insert into public.package_distributions (
      package_registration_id,
      property_id,
      package_number,
      registered_recipient_name,
      recipient_name,
      security_hand_over,
      note,
      distributed_at,
      status
    )
    values (
      p_package_registration_id,
      (select pr.property_id from public.package_registrations pr where pr.id = p_package_registration_id),
      v_pkg.submission_id,
      (select pr.recipient_name from public.package_registrations pr where pr.id = p_package_registration_id),
      trim(p_recipient_name),
      trim(p_security_hand_over),
      nullif(trim(coalesce(p_note,'')), ''),
      now(),
      'DISTRIBUTED'
    )
    returning * into v_distribution;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'Package has already been distributed.';
  end;

  return jsonb_build_object(
    'success', true,
    'message', 'Package successfully distributed.',
    'distribution', jsonb_build_object(
      'id', v_distribution.id,
      'distribution_number', v_distribution.distribution_number,
      'package_number', v_distribution.package_number,
      'recipient_name', v_distribution.recipient_name,
      'security_hand_over', v_distribution.security_hand_over,
      'note', v_distribution.note,
      'distributed_at', v_distribution.distributed_at,
      'status', v_distribution.status
    )
  );
end;
$$;

revoke execute on function public.distribute_package(uuid,text,text,text) from public, anon;
grant execute on function public.distribute_package(uuid,text,text,text) to authenticated;
