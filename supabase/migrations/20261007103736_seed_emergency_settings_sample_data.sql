-- SECUREOPS Emergency Settings sample configuration for HIKJ.
-- Idempotent seed for property 9ca8c398-c376-4d7a-8b74-91a8ffb771e7.
do $$
declare
  p uuid := '9ca8c398-c376-4d7a-8b74-91a8ffb771e7';
begin
  insert into public.emergency_contact_groups(property_id,code,name,description,whatsapp_group_url,active)
  select p,'ERT','Emergency Response Team','Primary emergency coordination group. Configure the real WhatsApp group URL in Settings.','',true
  where not exists (select 1 from public.emergency_contact_groups where property_id=p and code='ERT');
  insert into public.emergency_contact_groups(property_id,code,name,description,whatsapp_group_url,active)
  select p,'SECURITY','Security & Loss Prevention','Security response and incident coordination group.','',true
  where not exists (select 1 from public.emergency_contact_groups where property_id=p and code='SECURITY');
  insert into public.emergency_contact_groups(property_id,code,name,description,whatsapp_group_url,active)
  select p,'ENGINEERING','Engineering / Maintenance','Engineering response for utility, building-system and technical incidents.','',true
  where not exists (select 1 from public.emergency_contact_groups where property_id=p and code='ENGINEERING');
  insert into public.emergency_contact_groups(property_id,code,name,description,whatsapp_group_url,active)
  select p,'MANAGEMENT','Hotel Management','Management escalation and executive awareness group.','',true
  where not exists (select 1 from public.emergency_contact_groups where property_id=p and code='MANAGEMENT');

  insert into public.emergency_contacts(property_id,full_name,position,department,phone_number,email,whatsapp_number,priority,active)
  select p,'Duty Manager (Sample)','Manager on Duty','Front Office','', 'emergency-duty@example.com','',10,true
  where not exists (select 1 from public.emergency_contacts where property_id=p and email='emergency-duty@example.com');
  insert into public.emergency_contacts(property_id,full_name,position,department,phone_number,email,whatsapp_number,priority,active)
  select p,'Security Manager (Sample)','Security Manager','Security','', 'security-emergency@example.com','',20,true
  where not exists (select 1 from public.emergency_contacts where property_id=p and email='security-emergency@example.com');
  insert into public.emergency_contacts(property_id,full_name,position,department,phone_number,email,whatsapp_number,priority,active)
  select p,'Engineering Duty Manager (Sample)','Duty Engineer','Engineering','', 'engineering-emergency@example.com','',30,true
  where not exists (select 1 from public.emergency_contacts where property_id=p and email='engineering-emergency@example.com');
  insert into public.emergency_contacts(property_id,full_name,position,department,phone_number,email,whatsapp_number,priority,active)
  select p,'IT Manager (Sample)','IT Manager','IT','', 'it-emergency@example.com','',40,true
  where not exists (select 1 from public.emergency_contacts where property_id=p and email='it-emergency@example.com');
  insert into public.emergency_contacts(property_id,full_name,position,department,phone_number,email,whatsapp_number,priority,active)
  select p,'Hotel Manager on Duty (Sample)','Hotel Manager','Management','', 'management-emergency@example.com','',50,true
  where not exists (select 1 from public.emergency_contacts where property_id=p and email='management-emergency@example.com');

  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'default_severity','"URGENT"'::jsonb,'Default severity for new emergency incidents.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='default_severity');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'default_incident_type_code','"FIRE"'::jsonb,'Default incident type selected by Emergency Operations.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='default_incident_type_code');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'default_location','"Hotel Indonesia Kempinski Jakarta"'::jsonb,'Default incident location shown in Emergency Operations.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='default_location');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'timezone','"Asia/Jakarta"'::jsonb,'Application timezone used for emergency timestamps.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='timezone');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'incident_id_prefix','"HIKJ-INC"'::jsonb,'Incident identifier prefix.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='incident_id_prefix');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'auto_refresh_seconds','30'::jsonb,'Emergency Operations dashboard refresh interval in seconds.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='auto_refresh_seconds');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'production_enabled','true'::jsonb,'Allow production emergency mode. Keep enabled only after real recipients and SMTP are configured.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='production_enabled');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'require_production_confirmation','true'::jsonb,'Require explicit confirmation before production emergency dispatch.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='require_production_confirmation');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'require_recipient_selection','true'::jsonb,'Require at least one emergency recipient before incident creation.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='require_recipient_selection');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'notification_retry_count','3'::jsonb,'Maximum notification retry attempts.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='notification_retry_count');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'acknowledgement_timeout_minutes','10'::jsonb,'Target acknowledgement window in minutes.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='acknowledgement_timeout_minutes');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'retention_days','90'::jsonb,'Target retention period for emergency records.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='retention_days');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'smtp_host','"smtp.gmail.com"'::jsonb,'SMTP host metadata. Replace with the approved production provider.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='smtp_host');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'smtp_port','465'::jsonb,'SMTP port metadata. Sample uses 465/SSL.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='smtp_port');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'smtp_secure','true'::jsonb,'Use SSL for the sample SMTP configuration.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='smtp_secure');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'smtp_from','"emergency@example.com"'::jsonb,'Sample From address. Replace with the approved hotel emergency mailbox.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='smtp_from');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'smtp_from_name','"HIKJ Emergency Response (SAMPLE)"'::jsonb,'Display name used for emergency email notifications.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='smtp_from_name');
  insert into public.emergency_settings(property_id,setting_key,setting_value,description,active)
  select p,'smtp_reply_to','"emergency@example.com"'::jsonb,'Sample Reply-To address.',true
  where not exists (select 1 from public.emergency_settings where property_id=p and setting_key='smtp_reply_to');
end $$;

insert into public.emergency_group_members(group_id,contact_id,property_id)
select g.id,c.id,g.property_id
from public.emergency_contact_groups g
cross join public.emergency_contacts c
where g.property_id='9ca8c398-c376-4d7a-8b74-91a8ffb771e7'
  and c.property_id=g.property_id
  and (
    (g.code='ERT' and c.email in ('emergency-duty@example.com','security-emergency@example.com','engineering-emergency@example.com','it-emergency@example.com','management-emergency@example.com'))
    or (g.code='SECURITY' and c.email='security-emergency@example.com')
    or (g.code='ENGINEERING' and c.email='engineering-emergency@example.com')
    or (g.code='MANAGEMENT' and c.email='management-emergency@example.com')
  )
  and not exists (
    select 1 from public.emergency_group_members m
    where m.group_id=g.id and m.contact_id=c.id and m.property_id=g.property_id
  );
