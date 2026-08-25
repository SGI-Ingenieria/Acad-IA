-- Supabase Vault is independent from pgsodium and retains the existing
-- project root key. Avoid CASCADE so any unexpected external dependency makes
-- the deployment fail safely instead of deleting application objects.
DROP EXTENSION IF EXISTS pgsodium;
