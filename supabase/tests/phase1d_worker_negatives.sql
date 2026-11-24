\set ON_ERROR_STOP on

begin;

-- Fixtures are read-only to application identities. The duplicate document
-- belongs to a second worker in the same organization and is rolled back.
insert into public.workers (
  id, organization_id, employee_code, document_type, document_normalized,
  first_name, last_name, email, phone, start_date, position, status
) values (
  '40000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000001', 'A-DUP-01', 'DNI', '12345678Z',
  'Duplicado', 'Prueba', 'duplicate@example.test', '600111222', '2020-01-02',
  'Prueba', 'active'
);

create function pg_temp.phase1d_assert(v boolean, m text) returns void
language plpgsql as $$
begin
  if v is distinct from true then
    raise exception 'FALLO: %', m;
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select pg_temp.phase1d_assert(
  current_user = 'authenticated'
  and auth.uid() = '00000000-0000-0000-0000-000000000102'::uuid,
  'active admin identity'
);

-- Creating this table as the evaluated application role lets helper functions
-- read the snapshot without granting it access to a postgres-owned temp table.
create temp table baseline as
select to_jsonb(w) as worker_json,
       w.id,
       w.revision,
       coalesce(jsonb_agg(to_jsonb(a) order by a.id) filter (where a.id is not null), '[]'::jsonb) as audit_json
from public.workers w
left join public.worker_audit_log a on a.worker_id = w.id
where w.id = '40000000-0000-0000-0000-000000000001'
group by w.id, w.revision;
select pg_temp.phase1d_assert((select count(*) from baseline) = 1, 'baseline has exactly one worker');

create function pg_temp.assert_unchanged(p_label text) returns void
language plpgsql as $$
begin
  perform pg_temp.phase1d_assert(
    (select to_jsonb(w) from public.workers w where w.id = (select id from baseline))
      = (select worker_json from baseline),
    p_label || ': worker changed'
  );
  perform pg_temp.phase1d_assert(
    (select revision from public.workers where id = (select id from baseline))
      = (select revision from baseline),
    p_label || ': revision changed'
  );
  perform pg_temp.phase1d_assert(
    (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
     from public.worker_audit_log a where a.worker_id = (select id from baseline))
      = (select audit_json from baseline),
    p_label || ': audit changed'
  );
end;
$$;

create function pg_temp.expect_error(p_patch jsonb, p_state text, p_label text) returns void
language plpgsql as $$
begin
  begin
    perform public.update_worker_with_revision(
      (select id from baseline), (select revision from baseline), p_patch
    );
    raise exception 'FALLO: % was accepted', p_label;
  exception when others then
    if sqlstate <> p_state then
      raise exception 'FALLO: % returned SQLSTATE %, expected % (%).',
        p_label, sqlstate, p_state, sqlerrm;
    end if;
  end;
  perform pg_temp.assert_unchanged(p_label);
end;
$$;

-- JSON primitive/container values must never be coerced implicitly to text.
select pg_temp.expect_error('{"phone":123}'::jsonb, '22023', 'phone number');
select pg_temp.expect_error('{"phone":true}'::jsonb, '22023', 'phone boolean');
select pg_temp.expect_error('{"phone":[]}'::jsonb, '22023', 'phone array');
select pg_temp.expect_error('{"phone":{}}'::jsonb, '22023', 'phone object');
select pg_temp.expect_error('{"first_name":123}'::jsonb, '22023', 'first_name number');
select pg_temp.expect_error('{"email":false}'::jsonb, '22023', 'email boolean');
select pg_temp.expect_error('{"start_date":20261114}'::jsonb, '22023', 'start_date number');
select pg_temp.expect_error('{"start_date":"fecha-invalida"}'::jsonb, '22007', 'invalid start_date');

-- Required fields cannot be JSON null; optional fields can be deliberately cleared.
select pg_temp.expect_error('{"employee_code":null}'::jsonb, '22023', 'employee_code null');
select pg_temp.expect_error('{"document_type":null}'::jsonb, '22023', 'document_type null');
select pg_temp.expect_error('{"document_normalized":null}'::jsonb, '22023', 'document_normalized null');
select pg_temp.expect_error('{"first_name":null}'::jsonb, '22023', 'first_name null');
select pg_temp.expect_error('{"last_name":null}'::jsonb, '22023', 'last_name null');

-- The explicitly accepted optional-null contract is exercised with a real value
-- first; it is not counted as a rejected patch.
select public.update_worker_with_revision(
  (select id from baseline), (select revision from baseline),
  '{"email":"before-null@example.test","phone":"600222333","start_date":"2020-02-03","position":"Temporal"}'::jsonb
);
update baseline set worker_json = (select to_jsonb(w) from public.workers w where w.id = baseline.id),
                    revision = (select revision from public.workers w where w.id = baseline.id),
                    audit_json = (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb) from public.worker_audit_log a where a.worker_id = baseline.id);
select public.update_worker_with_revision(
  (select id from baseline), (select revision from baseline),
  '{"email":null,"phone":null,"start_date":null,"position":null}'::jsonb
);
select pg_temp.phase1d_assert(
  (select email is null and phone is null and start_date is null and position is null from public.workers where id = (select id from baseline)),
  'optional JSON null clears optional fields'
);
update baseline set worker_json = (select to_jsonb(w) from public.workers w where w.id = baseline.id),
                    revision = (select revision from public.workers w where w.id = baseline.id),
                    audit_json = (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb) from public.worker_audit_log a where a.worker_id = baseline.id);

-- Closed patch contract, stale writes, and data constraints.
select pg_temp.expect_error('{"unknown":"x"}'::jsonb, '22023', 'unknown key');
select pg_temp.expect_error('{"id":"40000000-0000-0000-0000-000000000001"}'::jsonb, '22023', 'protected key');
select pg_temp.expect_error('{}'::jsonb, '22023', 'empty patch');
select pg_temp.expect_error('{"document_type":"PASSPORT"}'::jsonb, '22023', 'unsupported document type');
select pg_temp.expect_error('{"document_normalized":"12345678Z"}'::jsonb, '23505', 'duplicate document');

-- This asserts the domain rule, not merely the type or unique index.
select pg_temp.expect_error('{"document_normalized":"12345678A"}'::jsonb, '22023', 'invalid document checksum');

rollback;
select 'phase1d_worker_negatives: OK' as result;
