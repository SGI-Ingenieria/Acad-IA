DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = r.tablename
        AND policyname = 'policy_name'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR ALL TO public USING (true)',
        'policy_name',
        'public',
        r.tablename
      );
    END IF;
  END LOOP;
END
$$;