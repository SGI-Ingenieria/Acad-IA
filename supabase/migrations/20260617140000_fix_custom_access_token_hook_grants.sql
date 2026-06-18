-- The custom_access_token hook in config.toml requires these grants.
-- Without them, GoTrue returns 500 whenever it calls the hook (user creation, sign-in).
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
