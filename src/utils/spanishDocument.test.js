import { describe, it } from 'vitest'
import { domainCases } from '../../tests/cases/phase1b.cases.mjs'
describe('documentos y validacion del dominio de trabajadores', () => {
  for (const [name, run] of domainCases) it(name, run)
})
