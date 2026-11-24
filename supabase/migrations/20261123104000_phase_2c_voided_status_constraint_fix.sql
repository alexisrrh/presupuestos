-- Corrección de 2C: en instalaciones existentes PostgreSQL asignó al CHECK
-- original el nombre work_sessions_status_check, que no coincidía con el
-- patrón de sustitución inicial. El nuevo CHECK ya está instalado y conserva
-- las reglas de open/closed; solo retiramos el heredado incompatible.
begin;

alter table public.work_sessions
  drop constraint if exists work_sessions_status_check;

commit;
