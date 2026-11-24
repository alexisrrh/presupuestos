import { describe, it } from 'vitest'
import { repositoryCases } from '../../../tests/cases/phase1b.cases.mjs'
describe('repositorio de trabajadores en memoria - regresiones', () => {
  for (const [name, run] of repositoryCases) it(name, run)
})
