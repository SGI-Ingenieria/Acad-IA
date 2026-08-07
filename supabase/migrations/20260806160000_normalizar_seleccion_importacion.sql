-- Compatibilidad para entornos que alcanzaron a aplicar la revisión anterior.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.aplicar_importacion_expediente(uuid)'::regprocedure
  ) into v_definition;

  if position('''RECOMENDADA''' in v_definition) > 0 then
    execute replace(v_definition, '''RECOMENDADA''', '''AUTOMATICA''');
  end if;
end;
$$;
