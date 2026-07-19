create or replace function public.save_budget_with_details(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  budget_payload jsonb := payload->'budget';
  chapters_payload jsonb := coalesce(payload->'chapters', '[]'::jsonb);
  v_organization_id uuid := (budget_payload->>'organization_id')::uuid;
  v_budget_id uuid;
  chapter_payload jsonb;
  item_payload jsonb;
  chapter_id uuid;
begin
  if auth.uid() is null or not public.is_organization_member(v_organization_id) then
    raise exception 'No autorizado.';
  end if;

  v_budget_id := nullif(budget_payload->>'id', '')::uuid;

  if v_budget_id is null then
    insert into public.budgets (
      organization_id, budget_number, title, status, document_type,
      client_name, client_tax_id, client_email, client_phone, client_address,
      project_address, issue_date, validity_days, notes, conditions,
      technical_report, tax_rate, discount_rate, subtotal, discount_amount,
      tax_amount, total, created_by
    )
    values (
      v_organization_id,
      budget_payload->>'budget_number',
      budget_payload->>'title',
      coalesce(budget_payload->>'status', 'draft'),
      coalesce(budget_payload->>'document_type', 'quick'),
      budget_payload->>'client_name',
      budget_payload->>'client_tax_id',
      budget_payload->>'client_email',
      budget_payload->>'client_phone',
      budget_payload->>'client_address',
      budget_payload->>'project_address',
      nullif(budget_payload->>'issue_date', '')::date,
      coalesce(nullif(budget_payload->>'validity_days', '')::integer, 0),
      budget_payload->>'notes',
      coalesce(budget_payload->'conditions', '{}'::jsonb),
      coalesce(budget_payload->'technical_report', '{}'::jsonb),
      coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'subtotal', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'discount_amount', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'tax_amount', '')::numeric, 0),
      coalesce(nullif(budget_payload->>'total', '')::numeric, 0),
      auth.uid()
    )
    returning id into v_budget_id;
  else
    update public.budgets
    set
      budget_number = budget_payload->>'budget_number',
      title = budget_payload->>'title',
      status = coalesce(budget_payload->>'status', 'draft'),
      document_type = coalesce(budget_payload->>'document_type', 'quick'),
      client_name = budget_payload->>'client_name',
      client_tax_id = budget_payload->>'client_tax_id',
      client_email = budget_payload->>'client_email',
      client_phone = budget_payload->>'client_phone',
      client_address = budget_payload->>'client_address',
      project_address = budget_payload->>'project_address',
      issue_date = nullif(budget_payload->>'issue_date', '')::date,
      validity_days = coalesce(nullif(budget_payload->>'validity_days', '')::integer, 0),
      notes = budget_payload->>'notes',
      conditions = coalesce(budget_payload->'conditions', '{}'::jsonb),
      technical_report = coalesce(budget_payload->'technical_report', '{}'::jsonb),
      tax_rate = coalesce(nullif(budget_payload->>'tax_rate', '')::numeric, 0),
      discount_rate = coalesce(nullif(budget_payload->>'discount_rate', '')::numeric, 0),
      subtotal = coalesce(nullif(budget_payload->>'subtotal', '')::numeric, 0),
      discount_amount = coalesce(nullif(budget_payload->>'discount_amount', '')::numeric, 0),
      tax_amount = coalesce(nullif(budget_payload->>'tax_amount', '')::numeric, 0),
      total = coalesce(nullif(budget_payload->>'total', '')::numeric, 0)
    where id = v_budget_id and organization_id = v_organization_id;
  end if;

  delete from public.budget_chapters where budget_id = v_budget_id;

  for chapter_payload in select * from jsonb_array_elements(chapters_payload)
  loop
    insert into public.budget_chapters (
      budget_id, title, name, description, position, subtotal, organization_id
    )
    values (
      v_budget_id,
      chapter_payload->>'title',
      chapter_payload->>'title',
      chapter_payload->>'description',
      coalesce(nullif(chapter_payload->>'position', '')::integer, 0),
      coalesce(nullif(chapter_payload->>'subtotal', '')::numeric, 0),
      v_organization_id
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
        item_payload->>'description',
        item_payload->>'unit',
        coalesce(nullif(item_payload->>'quantity', '')::numeric, 0),
        coalesce(nullif(item_payload->>'unit_price', '')::numeric, 0),
        coalesce(nullif(item_payload->>'total', '')::numeric, 0),
        coalesce(nullif(item_payload->>'position', '')::integer, 0)
      );
    end loop;
  end loop;

  return jsonb_build_object('id', v_budget_id);
end;
$$;

revoke all on function public.save_budget_with_details(jsonb) from public;
grant execute on function public.save_budget_with_details(jsonb) to authenticated;
