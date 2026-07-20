create or replace function public.generate_next_budget_number(target_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_year integer := extract(year from current_date)::integer;
  v_next_sequence integer;
begin
  if auth.uid() is null or not public.is_organization_member(target_organization_id) then
    raise exception 'No autorizado.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'budget_number:' || target_organization_id::text || ':' || v_year::text,
      0
    )
  );

  select coalesce(
    max((
      substring(
        budget_number
        from ('^PR-' || v_year::text || '-([0-9]{4})$')
      )
    )::integer),
    0
  ) + 1
  into v_next_sequence
  from public.budgets
  where organization_id = target_organization_id;

  return 'PR-' || v_year::text || '-' || lpad(v_next_sequence::text, 4, '0');
end;
$$;

alter function public.generate_next_budget_number(uuid) owner to postgres;
revoke all on function public.generate_next_budget_number(uuid) from public;
grant execute on function public.generate_next_budget_number(uuid) to authenticated;

create or replace function public.save_budget_with_details(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  budget_payload jsonb := payload->'budget';
  chapters_payload jsonb := coalesce(payload->'chapters', '[]'::jsonb);
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_existing_organization_id uuid;
  v_existing_budget_number text;
  v_budget_id uuid;
  v_budget_number text;
  v_requested_budget_number text;
  v_client_id uuid;
  chapter_payload jsonb;
  item_payload jsonb;
  chapter_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if budget_payload is null then
    raise exception 'Payload de presupuesto invalido.';
  end if;

  v_organization_id := nullif(budget_payload->>'organization_id', '')::uuid;

  if v_organization_id is null or not public.is_organization_member(v_organization_id) then
    raise exception 'No autorizado.';
  end if;

  v_client_id := nullif(budget_payload->>'client_id', '')::uuid;

  if v_client_id is not null and not exists (
    select 1 from public.clients
    where id = v_client_id and organization_id = v_organization_id
  ) then
    raise exception 'El cliente no pertenece a la organizacion del presupuesto.';
  end if;

  v_budget_id := nullif(budget_payload->>'id', '')::uuid;

  if v_budget_id is not null then
    select organization_id, budget_number
    into v_existing_organization_id, v_existing_budget_number
    from public.budgets
    where id = v_budget_id;

    if v_existing_organization_id is null then
      raise exception 'Presupuesto no encontrado.';
    end if;

    if v_existing_organization_id <> v_organization_id then
      raise exception 'No autorizado.';
    end if;

    v_budget_number := v_existing_budget_number;
  else
    perform pg_advisory_xact_lock(
      hashtextextended(
        'budget_number:' ||
          v_organization_id::text ||
          ':' ||
          extract(year from current_date)::integer::text,
        0
      )
    );

    v_requested_budget_number := nullif(budget_payload->>'budget_number', '');
    v_budget_number := public.generate_next_budget_number(v_organization_id);

    if v_requested_budget_number = v_budget_number and not exists (
      select 1
      from public.budgets
      where organization_id = v_organization_id
        and budget_number = v_requested_budget_number
    ) then
      v_budget_number := v_requested_budget_number;
    end if;
  end if;

  if v_budget_id is null then
    insert into public.budgets (
      organization_id, client_id, budget_number, title, status, document_type,
      client_name, client_tax_id, client_email, client_phone, client_address,
      project_address, issue_date, validity_days, notes, conditions,
      technical_report, tax_rate, discount_rate, subtotal, discount_amount,
      tax_amount, total, budget_date, project_name, client_snapshot,
      discount_percentage, vat_percentage, created_by
    )
    values (
      v_organization_id,
      v_client_id,
      v_budget_number,
      coalesce(nullif(budget_payload->>'title', ''), 'Presupuesto de obra'),
      coalesce(nullif(budget_payload->>'status', ''), 'draft'),
      coalesce(nullif(budget_payload->>'document_type', ''), 'quick'),
      coalesce(budget_payload->>'client_name', ''),
      coalesce(budget_payload->>'client_tax_id', ''),
      coalesce(budget_payload->>'client_email', ''),
      coalesce(budget_payload->>'client_phone', ''),
      coalesce(budget_payload->>'client_address', ''),
      coalesce(budget_payload->>'project_address', ''),
      nullif(budget_payload->>'issue_date', '')::date,
      coalesce(nullif(budget_payload->>'validity_days', '')::integer, 30),
      coalesce(budget_payload->>'notes', ''),
      coalesce(budget_payload->'conditions', '{}'::jsonb),
      coalesce(budget_payload->'technical_report', '{}'::jsonb),
      coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 21),
      coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'subtotal', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'discount_amount', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'tax_amount', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'total', '')::numeric, 0),
      nullif(budget_payload->>'issue_date', '')::date,
      coalesce(nullif(budget_payload->>'title', ''), 'Presupuesto de obra'),
      jsonb_strip_nulls(jsonb_build_object(
        'name', budget_payload->>'client_name',
        'tax_id', budget_payload->>'client_tax_id',
        'email', budget_payload->>'client_email',
        'phone', budget_payload->>'client_phone',
        'address', budget_payload->>'client_address'
      )),
      coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 21),
      v_user_id
    )
    returning id into v_budget_id;
  else
    update public.budgets
    set
      client_id = v_client_id,
      budget_number = v_budget_number,
      title = coalesce(nullif(budget_payload->>'title', ''), 'Presupuesto de obra'),
      status = coalesce(nullif(budget_payload->>'status', ''), 'draft'),
      document_type = coalesce(nullif(budget_payload->>'document_type', ''), 'quick'),
      client_name = coalesce(budget_payload->>'client_name', ''),
      client_tax_id = coalesce(budget_payload->>'client_tax_id', ''),
      client_email = coalesce(budget_payload->>'client_email', ''),
      client_phone = coalesce(budget_payload->>'client_phone', ''),
      client_address = coalesce(budget_payload->>'client_address', ''),
      project_address = coalesce(budget_payload->>'project_address', ''),
      issue_date = nullif(budget_payload->>'issue_date', '')::date,
      validity_days = coalesce(nullif(budget_payload->>'validity_days', '')::integer, 30),
      notes = coalesce(budget_payload->>'notes', ''),
      conditions = coalesce(budget_payload->'conditions', '{}'::jsonb),
      technical_report = coalesce(budget_payload->'technical_report', '{}'::jsonb),
      tax_rate = coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 21),
      discount_rate = coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      subtotal = coalesce(nullif(budget_payload->>'subtotal', '')::numeric, 0),
      discount_amount = coalesce(nullif(budget_payload->>'discount_amount', '')::numeric, 0),
      tax_amount = coalesce(nullif(budget_payload->>'tax_amount', '')::numeric, 0),
      total = coalesce(nullif(budget_payload->>'total', '')::numeric, 0),
      budget_date = nullif(budget_payload->>'issue_date', '')::date,
      project_name = coalesce(nullif(budget_payload->>'title', ''), 'Presupuesto de obra'),
      client_snapshot = jsonb_strip_nulls(jsonb_build_object(
        'name', budget_payload->>'client_name',
        'tax_id', budget_payload->>'client_tax_id',
        'email', budget_payload->>'client_email',
        'phone', budget_payload->>'client_phone',
        'address', budget_payload->>'client_address'
      )),
      discount_percentage = coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      vat_percentage = coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 21)
    where id = v_budget_id
      and organization_id = v_organization_id;

    if not found then
      raise exception 'Presupuesto no encontrado.';
    end if;
  end if;

  delete from public.budget_chapters
  where budget_id = v_budget_id
    and organization_id = v_organization_id;

  for chapter_payload in select * from jsonb_array_elements(chapters_payload)
  loop
    insert into public.budget_chapters (
      budget_id, organization_id, title, name, description, position, subtotal
    )
    values (
      v_budget_id,
      v_organization_id,
      coalesce(nullif(chapter_payload->>'title', ''), nullif(chapter_payload->>'name', ''), 'Capitulo'),
      coalesce(nullif(chapter_payload->>'name', ''), nullif(chapter_payload->>'title', ''), 'Capitulo'),
      coalesce(chapter_payload->>'description', ''),
      coalesce(nullif(chapter_payload->>'position', '')::integer, 0),
      coalesce(nullif(chapter_payload->>'subtotal', '')::numeric, 0)
    )
    returning id into chapter_id;

    for item_payload in select * from jsonb_array_elements(coalesce(chapter_payload->'items', '[]'::jsonb))
    loop
      insert into public.budget_items (
        chapter_id, organization_id, description, unit, quantity, unit_price, total, position
      )
      values (
        chapter_id,
        v_organization_id,
        coalesce(item_payload->>'description', ''),
        coalesce(item_payload->>'unit', ''),
        coalesce(nullif(item_payload->>'quantity', '')::numeric, 0),
        coalesce(nullif(item_payload->>'unit_price', '')::numeric, 0),
        coalesce(nullif(item_payload->>'total', '')::numeric, 0),
        coalesce(nullif(item_payload->>'position', '')::integer, 0)
      );
    end loop;
  end loop;

  return jsonb_build_object('id', v_budget_id, 'budget_number', v_budget_number);
end;
$$;

alter function public.save_budget_with_details(jsonb) owner to postgres;
revoke all on function public.save_budget_with_details(jsonb) from public;
grant execute on function public.save_budget_with_details(jsonb) to authenticated;

notify pgrst, 'reload schema';
