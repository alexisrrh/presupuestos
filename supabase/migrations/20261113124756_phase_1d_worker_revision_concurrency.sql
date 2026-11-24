-- Control optimista: una edicion debe declarar la revision que leyo.
alter table public.workers add column if not exists revision integer not null default 1 check (revision > 0);

create or replace function public.workers_increment_revision()
returns trigger language plpgsql as $$
begin
  if new.revision <> old.revision then raise exception 'La revision no puede establecerse directamente.'; end if;
  new.revision := old.revision + 1;
  return new;
end;
$$;
drop trigger if exists workers_increment_revision on public.workers;
create trigger workers_increment_revision before update on public.workers
for each row execute function public.workers_increment_revision();

create or replace function public.update_worker_phone_with_revision(p_worker_id uuid, p_expected_revision integer, p_phone text)
returns public.workers language plpgsql security invoker set search_path = public as $$
declare result public.workers;
begin
  update public.workers set phone = p_phone
  where id = p_worker_id and revision = p_expected_revision
  returning * into result;
  if not found then raise exception 'Conflicto de revision o ficha inaccesible.' using errcode = '40001'; end if;
  return result;
end;
$$;
revoke all on function public.update_worker_phone_with_revision(uuid,integer,text) from public, anon;
grant execute on function public.update_worker_phone_with_revision(uuid,integer,text) to authenticated;
