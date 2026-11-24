import { describe, it } from 'vitest'
import { fileCases } from '../tests/cases/phase1b-files.cases.mjs'
describe('estructura demo (no sustituye navegador)', () => {
  for (const [name, run] of fileCases) it(name, run)
})
