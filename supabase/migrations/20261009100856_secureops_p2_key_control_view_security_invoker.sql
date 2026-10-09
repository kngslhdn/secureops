-- SECUREOPS P2: enforce caller privileges and base-table RLS for key-control view.
-- The later key partial-return migration recreated this view and dropped the
-- security_invoker reloption. Restore it so authenticated reads respect RLS.
ALTER VIEW public.key_control_transactions SET (security_invoker = true);
