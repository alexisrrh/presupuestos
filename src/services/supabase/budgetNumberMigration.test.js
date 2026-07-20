import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../../../supabase/migrations/20260720130000_fix_budget_number_generation.sql',
    import.meta.url,
  ),
  'utf8',
)

describe('budget number SQL migration', () => {
  it('crea generate_next_budget_number para el primer presupuesto y consecutivos', () => {
    expect(migration).toContain(
      'create or replace function public.generate_next_budget_number',
    )
    expect(migration).toContain("return 'PR-' || v_year::text || '-'")
    expect(migration).toContain('lpad(v_next_sequence::text, 4,')
    expect(migration).toContain('max((')
  })

  it('usa bloqueo transaccional para creacion simultanea', () => {
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain("'budget_number:' || target_organization_id::text")
    expect(migration).toContain("'budget_number:' ||")
  })

  it('save_budget_with_details conserva numero en edicion y regenera duplicados nuevos', () => {
    expect(migration).toContain('v_budget_number := v_existing_budget_number')
    expect(migration).toContain('budget_number = v_budget_number')
    expect(migration).toContain('v_requested_budget_number := nullif')
    expect(migration).toContain(
      'v_budget_number := public.generate_next_budget_number(v_organization_id)',
    )
    expect(migration).toContain('v_requested_budget_number = v_budget_number')
    expect(migration).toContain("'budget_number', v_budget_number")
  })
})
