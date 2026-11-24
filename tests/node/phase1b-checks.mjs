// Name avoids *.test.mjs so Vitest does not run node:test as a test suite.
import { test } from 'node:test'
import { domainCases, repositoryCases, guardCases } from '../cases/phase1b.cases.mjs'
import { fileCases } from '../cases/phase1b-files.cases.mjs'
for (const [name, run] of [...domainCases, ...repositoryCases, ...guardCases, ...fileCases]) test(name, run)
