-- Plantilla Excel del mapa curricular por estructura de plan.
-- Hasta ahora el ID de plantilla Excel (Carbone) estaba hardcodeado en el edge
-- function carbone-io-wrapper. Esta columna permite gestionarla por estructura
-- desde la UI, igual que `template_id` para las plantillas Word.
ALTER TABLE public.estructuras_plan
  ADD COLUMN IF NOT EXISTS excel_template_id text;
