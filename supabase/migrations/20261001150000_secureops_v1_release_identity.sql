-- SECUREOPS V1 canonical release identity.
-- V1 is the initial official release baseline. Future release changes must use a new migration/version.
INSERT INTO public.app_settings (
  setting_key,
  setting_value,
  description,
  active,
  property_id
) VALUES (
  'application_identity',
  jsonb_build_object(
    'app_name','SECUREOPS',
    'app_title','SECUREOPS | Security Operations',
    'version','ks.v.001',
    'release','V1',
    'release_status','INITIAL_OFFICIAL_RELEASE'
  ),
  'Canonical SECUREOPS application identity for the initial official V1 release.',
  true,
  '9ca8c398-c376-4d7a-8b74-91a8ffb771e7'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value=EXCLUDED.setting_value,
    description=EXCLUDED.description,
    active=EXCLUDED.active,
    property_id=EXCLUDED.property_id,
    updated_at=now();
