begin;
grant priteca_worker_writer to postgres with set true;
grant create on schema priteca_private to priteca_worker_writer;
set local role priteca_worker_writer;
create or replace function priteca_private.update_worker_with_revision_impl(p_id uuid,p_revision integer,p_changes jsonb)
returns public.workers language plpgsql security definer set search_path=pg_catalog,public,priteca_private as $$
declare r public.workers; actor uuid; allowed text[]:=array['employee_code','document_type','document_normalized','first_name','last_name','email','phone','start_date','position']; required text[]:=array['employee_code','document_type','document_normalized','first_name','last_name']; optional text[]:=array['email','phone','start_date','position']; k text;
begin
 actor:=priteca_private.request_actor_id(); if actor is null then raise exception 'No autorizado.' using errcode='42501'; end if;
 if p_id is null or p_revision is null or p_revision<1 or p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then raise exception 'Entrada invalida.' using errcode='22023'; end if;
 for k in select jsonb_object_keys(p_changes) loop
   if not k=any(allowed) then raise exception 'Campo no permitido.' using errcode='22023'; end if;
   if k=any(required) and jsonb_typeof(p_changes->k)<>'string' then raise exception 'Tipo invalido.' using errcode='22023'; end if;
   if k=any(optional) and jsonb_typeof(p_changes->k) not in ('string','null') then raise exception 'Tipo invalido.' using errcode='22023'; end if;
 end loop;
 update public.workers set employee_code=case when p_changes?'employee_code' then p_changes->>'employee_code' else employee_code end, document_type=case when p_changes?'document_type' then p_changes->>'document_type' else document_type end, document_normalized=case when p_changes?'document_normalized' then p_changes->>'document_normalized' else document_normalized end, first_name=case when p_changes?'first_name' then p_changes->>'first_name' else first_name end, last_name=case when p_changes?'last_name' then p_changes->>'last_name' else last_name end, email=case when p_changes?'email' then p_changes->>'email' else email end, phone=case when p_changes?'phone' then p_changes->>'phone' else phone end, position=case when p_changes?'position' then p_changes->>'position' else position end, start_date=case when p_changes?'start_date' then (p_changes->>'start_date')::date else start_date end where id=p_id and revision=p_revision and public.is_organization_admin(organization_id) returning * into r;
 if not found then raise exception 'Conflicto o ficha inaccesible.' using errcode='40001'; end if; return r;
end $$;
reset role;
revoke create on schema priteca_private from priteca_worker_writer;
grant priteca_worker_writer to postgres with set false;
commit;
