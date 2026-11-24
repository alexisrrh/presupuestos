import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WorkersWorkspace from '../components/workers/WorkersWorkspace'
import { createMemoryWorkerRepository } from '../services/workers/memoryWorkerRepository.js'
import { demoWorkers } from '../data/demoWorkers'

if (!import.meta.env.DEV || import.meta.env.MODE !== 'local-demo' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
  throw new Error('La demo solo se sirve en desarrollo local deliberado.')
}
// The fake context belongs only to this isolated entry, never to the normal Auth flow.
const demoContext = Object.freeze({ userId: 'demo-admin', organizationId: 'demo-priteca', role: 'admin', isActive: true, displayName: 'Administración de prueba' })
const repository = createMemoryWorkerRepository(demoWorkers, { getContext: () => demoContext })
createRoot(document.getElementById('root')).render(
  <StrictMode><WorkersWorkspace repository={repository} contextKey="demo-admin:demo-priteca" canManage /></StrictMode>,
)
