-- Borradores persistentes para campos largos de Datos Generales.
-- Un borrador por entidad/campo, compartido por el equipo editor.

CREATE TABLE IF NOT EXISTS public.borradores_campo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad text NOT NULL CHECK (entidad IN ('plan', 'asignatura')),
  entidad_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.planes_estudio(id) ON DELETE CASCADE,
  clave text NOT NULL,
  contenido_html text NOT NULL DEFAULT '',
  creado_por uuid REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  actualizado_por uuid REFERENCES public.usuarios_app(id) ON DELETE SET NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entidad, entidad_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_borradores_campo_plan
  ON public.borradores_campo (plan_id, actualizado_en DESC);

CREATE INDEX IF NOT EXISTS idx_borradores_campo_entidad
  ON public.borradores_campo (entidad, entidad_id);

CREATE OR REPLACE FUNCTION public.fn_borradores_campo_set_plan_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entidad = 'plan' THEN
    NEW.plan_id := NEW.entidad_id;
  ELSIF NEW.entidad = 'asignatura' THEN
    SELECT a.plan_estudio_id
    INTO NEW.plan_id
    FROM public.asignaturas a
    WHERE a.id = NEW.entidad_id;

    IF NEW.plan_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró la asignatura % para el borrador', NEW.entidad_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  NEW.clave := btrim(NEW.clave);

  IF NEW.clave = '' THEN
    RAISE EXCEPTION 'La clave del borrador no puede estar vacía'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_borradores_campo_set_plan_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_borradores_campo_set_plan_id() TO authenticated, service_role;

DROP TRIGGER IF EXISTS aa_borradores_campo_set_plan_id ON public.borradores_campo;
CREATE TRIGGER aa_borradores_campo_set_plan_id
  BEFORE INSERT OR UPDATE ON public.borradores_campo
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_borradores_campo_set_plan_id();

DROP TRIGGER IF EXISTS aa_fill_author_borradores_campo ON public.borradores_campo;
CREATE TRIGGER aa_fill_author_borradores_campo
  BEFORE INSERT OR UPDATE ON public.borradores_campo
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_fill_author_from_auth_uid();

DROP TRIGGER IF EXISTS trg_borradores_campo_actualizado_en ON public.borradores_campo;
CREATE TRIGGER trg_borradores_campo_actualizado_en
  BEFORE UPDATE ON public.borradores_campo
  FOR EACH ROW
  EXECUTE FUNCTION public.set_actualizado_en();

ALTER TABLE public.borradores_campo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS borradores_campo_select_by_scope ON public.borradores_campo;
CREATE POLICY borradores_campo_select_by_scope ON public.borradores_campo
  FOR SELECT TO authenticated
  USING (
    CASE entidad
      WHEN 'plan' THEN public.authz_can_access_plan(entidad_id)
      WHEN 'asignatura' THEN public.authz_can_access_asignatura(entidad_id)
      ELSE false
    END
  );

DROP POLICY IF EXISTS borradores_campo_insert_by_scope ON public.borradores_campo;
CREATE POLICY borradores_campo_insert_by_scope ON public.borradores_campo
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE entidad
      WHEN 'plan' THEN public.authz_plan_write_allowed(entidad_id)
      WHEN 'asignatura' THEN public.usuario_puede_editar_asignatura(auth.uid(), entidad_id)
      ELSE false
    END
  );

DROP POLICY IF EXISTS borradores_campo_update_by_scope ON public.borradores_campo;
CREATE POLICY borradores_campo_update_by_scope ON public.borradores_campo
  FOR UPDATE TO authenticated
  USING (
    CASE entidad
      WHEN 'plan' THEN public.authz_plan_write_allowed(entidad_id)
      WHEN 'asignatura' THEN public.usuario_puede_editar_asignatura(auth.uid(), entidad_id)
      ELSE false
    END
  )
  WITH CHECK (
    CASE entidad
      WHEN 'plan' THEN public.authz_plan_write_allowed(entidad_id)
      WHEN 'asignatura' THEN public.usuario_puede_editar_asignatura(auth.uid(), entidad_id)
      ELSE false
    END
  );

DROP POLICY IF EXISTS borradores_campo_delete_by_scope ON public.borradores_campo;
CREATE POLICY borradores_campo_delete_by_scope ON public.borradores_campo
  FOR DELETE TO authenticated
  USING (
    CASE entidad
      WHEN 'plan' THEN public.authz_plan_write_allowed(entidad_id)
      WHEN 'asignatura' THEN public.usuario_puede_editar_asignatura(auth.uid(), entidad_id)
      ELSE false
    END
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.borradores_campo TO authenticated;
GRANT ALL ON public.borradores_campo TO service_role;
