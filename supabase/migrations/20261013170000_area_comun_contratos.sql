-- Reutilizar el programa curricular habitual sin inventar contenido ni exigirlo al sembrar.
update public.estructuras_asignatura destino set
  definicion=jsonb_set(origen.definicion,'{required}','[]'::jsonb),template_id=origen.template_id
from public.estructuras_asignatura origen join public.estructuras_plan ep on ep.id=origen.estructura_plan_id
where destino.id='ac000000-0000-4000-8000-000000000002'
  and ep.tipo='CURRICULAR' and ep.estado_publicacion='PUBLICADA';

-- La pertenencia real se comprueba en BD también si el JWT conserva permisos antiguos.
-- usuario_tiene_permiso conserva la simulación administrativa existente.
create or replace function private.area_comun_gestor(p_usuario uuid,p_publicar boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_usuario is not null and public.usuario_tiene_permiso(p_usuario,
    case when p_publicar then 'area_comun.publicar' else 'area_comun.gestionar' end);
$$;

-- La incorporación de una previsualización obsoleta debe rechazarse, no adoptar otra publicación.
do $$ declare d text; begin
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace='public'::regnamespace and proname='area_comun_incorporar';
  d:=replace(d,$txt$p_electivas jsonb DEFAULT '{}'::jsonb)$txt$,
    $txt$p_electivas jsonb DEFAULT '{}'::jsonb, p_publicacion_id uuid DEFAULT NULL::uuid)$txt$);
  d:=replace(d,'if pub.id is null then',
    'if p_publicacion_id is not null and p_publicacion_id is distinct from pub.id then raise exception ''La publicación cambió; revisa la línea antes de incorporarla'' using errcode=''40001''; end if; if pub.id is null then');
  drop function public.area_comun_incorporar(uuid,jsonb);
  execute d;
end $$;
revoke all on function public.area_comun_incorporar(uuid,jsonb,uuid) from public,anon;
grant execute on function public.area_comun_incorporar(uuid,jsonb,uuid) to authenticated;
