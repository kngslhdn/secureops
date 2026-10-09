-- SECUREOPS P3: address key discrepancy resolution query-performance advisories.
-- Index the resolved_by foreign key and cache auth.uid() per statement in RLS.
CREATE INDEX IF NOT EXISTS key_discrepancy_resolutions_resolved_by_idx
  ON public.key_discrepancy_resolutions (resolved_by);

DROP POLICY IF EXISTS key_discrepancy_resolutions_admin_select
  ON public.key_discrepancy_resolutions;
CREATE POLICY key_discrepancy_resolutions_admin_select
  ON public.key_discrepancy_resolutions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_profiles ap
      WHERE ap.user_id = (SELECT auth.uid())
        AND ap.active = true
        AND ap.role IN ('ADMIN', 'MANAGER', 'SUPERADMIN')
        AND (
          ap.role = 'SUPERADMIN'
          OR ap.property_id = key_discrepancy_resolutions.property_id
        )
    )
  );

DROP POLICY IF EXISTS key_discrepancy_resolutions_admin_insert
  ON public.key_discrepancy_resolutions;
CREATE POLICY key_discrepancy_resolutions_admin_insert
  ON public.key_discrepancy_resolutions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_profiles ap
      WHERE ap.user_id = (SELECT auth.uid())
        AND ap.active = true
        AND ap.role IN ('ADMIN', 'MANAGER', 'SUPERADMIN')
        AND (
          ap.role = 'SUPERADMIN'
          OR ap.property_id = key_discrepancy_resolutions.property_id
        )
    )
  );
