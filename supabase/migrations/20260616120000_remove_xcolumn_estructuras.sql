-- Eliminar campos mapeados a columna (x-column) de las estructuras.
--
-- Bajo la nueva convención, los campos que apuntaban a una columna real vía
-- "x-column" (p. ej. contenido_tematico, criterios_de_evaluacion, codigo) son
-- "campos siempre incluidos": se resuelven por su llave canónica y NO deben
-- declararse dentro de la estructura. Esta migración los quita del JSON Schema
-- (definicion) de cada estructura y depura el arreglo "required".
--
-- Idempotente: solo afecta filas cuyo "properties" tenga alguna propiedad con
-- la clave "x-column".

do $$
declare
  r record;
  nuevas_props jsonb;
  nuevo_required jsonb;
  nueva_definicion jsonb;
begin
  for r in
    select 'estructuras_plan'::text as tabla, id, definicion
      from public.estructuras_plan
    union all
    select 'estructuras_asignatura'::text as tabla, id, definicion
      from public.estructuras_asignatura
  loop
    if r.definicion is null
       or jsonb_typeof(r.definicion -> 'properties') <> 'object' then
      continue;
    end if;

    -- Propiedades que NO declaran x-column.
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      into nuevas_props
      from jsonb_each(r.definicion -> 'properties')
      where not (value ? 'x-column');

    -- Nada que limpiar en esta fila.
    if nuevas_props = (r.definicion -> 'properties') then
      continue;
    end if;

    -- required depurado a las llaves que sobreviven.
    if jsonb_typeof(r.definicion -> 'required') = 'array' then
      select coalesce(jsonb_agg(req), '[]'::jsonb)
        into nuevo_required
        from jsonb_array_elements_text(r.definicion -> 'required') as req
        where nuevas_props ? req;
    else
      nuevo_required := null;
    end if;

    nueva_definicion := jsonb_set(r.definicion, '{properties}', nuevas_props);
    if nuevo_required is not null then
      nueva_definicion := jsonb_set(nueva_definicion, '{required}', nuevo_required);
    end if;

    if r.tabla = 'estructuras_plan' then
      update public.estructuras_plan
        set definicion = nueva_definicion
        where id = r.id;
    else
      update public.estructuras_asignatura
        set definicion = nueva_definicion
        where id = r.id;
    end if;
  end loop;
end $$;
