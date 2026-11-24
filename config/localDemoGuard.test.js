import { describe, it } from 'vitest'
import { guardCases } from '../tests/cases/phase1b.cases.mjs'
describe('aislamiento de la demostracion local', () => {
  for (const [name, run] of guardCases) it(name, run)
})
