-- 002_rls_and_grants.sql — database-enforced tenant isolation (defence in depth behind the API's own checks).
--
-- How it works: every API request that touches tenant data runs inside a transaction that first executes
--   SELECT set_config('app.tenant_id', '<uuid>', true)
-- Policies below only expose rows whose tenant_id matches. Platform-level operations (super admin, login, tenant resolution)
-- run with  set_config('app.system', 'on', true)  from server code only. A request that forgets to set a tenant sees ZERO rows.
-- FORCE ROW LEVEL SECURITY makes the policies apply to the table owner too; only superusers / BYPASSRLS roles skip them,
-- so never run the API as one (the server refuses to start in production if it does).
 
CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;
 
CREATE OR REPLACE FUNCTION app_is_system() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT COALESCE(current_setting('app.system', true), '') = 'on' $$;
 
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_configs','users','photographers','clients','services','packages','bookings','booking_photographers',
                            'booking_notes','events','event_photographers','event_notes','galleries','gallery_photos','gallery_external_links',
                            'videos','drive_links','testimonials','blog_posts','notifications','contact_messages','audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_is_system() OR tenant_id = app_tenant_id()) WITH CHECK (app_is_system() OR tenant_id = app_tenant_id())', t);
  END LOOP;
END $$;
 
-- The tenants table: a tenant context may only see (and update) its own row; creating studios is a system operation.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON tenants USING (app_is_system() OR id = app_tenant_id()) WITH CHECK (app_is_system() OR id = app_tenant_id());
 
-- Least-privilege grants for the runtime role (created by database/setup.sql). Skipped silently if the role does not exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shivamstudio_app') THEN
    GRANT USAGE ON SCHEMA public TO shivamstudio_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shivamstudio_app;
    REVOKE UPDATE, DELETE ON audit_logs FROM shivamstudio_app;                       -- append-only
    REVOKE DELETE ON tenants, users FROM shivamstudio_app;                          -- these are soft-deleted (plans may be deleted when unused)
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO shivamstudio_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shivamstudio_app;
  END IF;
END $$;