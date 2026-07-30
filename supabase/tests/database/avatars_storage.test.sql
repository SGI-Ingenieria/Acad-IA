BEGIN;

SELECT plan(3);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'avatars'
      AND name = 'avatars'
      AND public
  ),
  'public avatars bucket exists'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'avatars_public_read'
  ),
  1,
  'avatars public read policy exists'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN (
        'avatars_authenticated_insert',
        'avatars_authenticated_update',
        'avatars_authenticated_delete'
      )
  ),
  3,
  'avatars authenticated write policies exist'
);

SELECT * FROM finish();

ROLLBACK;
