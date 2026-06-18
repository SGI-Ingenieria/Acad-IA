-- Rellena autoría desde la sesión autenticada cuando el cliente no la envía.
-- Las Edge Functions con service role pueden seguir enviando un autor explícito.

CREATE OR REPLACE FUNCTION public.fn_fill_author_from_auth_uid()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.creado_por IS NULL THEN
      NEW.creado_por := current_user_id;
    END IF;

    IF NEW.actualizado_por IS NULL THEN
      NEW.actualizado_por := current_user_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.actualizado_por IS NULL
      OR NEW.actualizado_por IS NOT DISTINCT FROM OLD.actualizado_por THEN
      NEW.actualizado_por := current_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_fill_author_from_auth_uid() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_fill_author_from_auth_uid() TO authenticated, service_role;

DROP TRIGGER IF EXISTS aa_fill_author_planes_estudio ON public.planes_estudio;
CREATE TRIGGER aa_fill_author_planes_estudio
  BEFORE INSERT OR UPDATE ON public.planes_estudio
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_fill_author_from_auth_uid();

DROP TRIGGER IF EXISTS aa_fill_author_asignaturas ON public.asignaturas;
CREATE TRIGGER aa_fill_author_asignaturas
  BEFORE INSERT OR UPDATE ON public.asignaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_fill_author_from_auth_uid();
