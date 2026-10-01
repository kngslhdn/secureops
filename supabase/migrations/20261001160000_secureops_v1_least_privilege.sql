-- SECUREOPS V1 security hardening: least-privilege Data API grants.
-- Public visitor submissions use Edge Functions with server-side service-role access,
-- so anonymous direct table access is not required.

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.tablename);
  END LOOP;
END $$;

-- Authenticated users access operational data through RLS-backed Edge Functions.
-- Keep direct Data API access read-only except for mutations that are explicitly
-- performed with the caller JWT and protected by property-scoped RLS.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', r.tablename);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', r.tablename);
  END LOOP;
END $$;

-- Caller-JWT mutation paths used by SECUREOPS Edge Functions.
GRANT INSERT, UPDATE, DELETE ON TABLE public.properties TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.package_distributions TO authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_acknowledgements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_contact_groups TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_contacts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_group_members TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_incident_recipients TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_incident_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_incident_updates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_incidents TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_message_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_notifications TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.emergency_settings TO authenticated;

-- Emergency API writes audit events using the caller JWT.
GRANT INSERT ON TABLE public.audit_logs TO authenticated;

-- No anonymous direct Data API execution of public functions.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Trigger functions execute through database triggers; callers do not need
-- direct EXECUTE privileges on these functions.
REVOKE ALL ON FUNCTION public.generate_hikj_record_id(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_package_distribution_public_id() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_submission_public_id() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_outstanding_key_borrowing_race() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_key_expected_return_at() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_key_return_quantity() FROM anon, authenticated;


-- Views are separate relations in PostgreSQL; remove anonymous direct access there too.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT table_name FROM information_schema.views WHERE table_schema='public' LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', r.table_name);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', r.table_name);
  END LOOP;
END $$;
