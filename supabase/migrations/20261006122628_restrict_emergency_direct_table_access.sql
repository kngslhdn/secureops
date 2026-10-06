revoke all on table
  public.emergency_acknowledgements,
  public.emergency_contact_groups,
  public.emergency_contacts,
  public.emergency_group_members,
  public.emergency_incident_recipients,
  public.emergency_incident_types,
  public.emergency_incident_updates,
  public.emergency_incidents,
  public.emergency_message_templates,
  public.emergency_notifications,
  public.emergency_settings
from anon, authenticated;

grant select on table
  public.emergency_acknowledgements,
  public.emergency_contact_groups,
  public.emergency_contacts,
  public.emergency_group_members,
  public.emergency_incident_recipients,
  public.emergency_incident_types,
  public.emergency_incident_updates,
  public.emergency_incidents,
  public.emergency_message_templates,
  public.emergency_notifications,
  public.emergency_settings
to authenticated;
