import { useMemo } from 'react'
import WorkersWorkspace from '../components/workers/WorkersWorkspace'
import { supabase } from '../lib/supabaseClient'
import { createSupabaseWorkerRepository } from '../services/workers/supabaseWorkerRepository'
import { createWorkerAccessService } from '../services/workers/workerAccessService'

export default function Workers({ membership }) {
  const organizationId = membership?.organization_id
  const repository = useMemo(() => {
    if (!organizationId || !supabase) return null
    return createSupabaseWorkerRepository({ client: supabase, organizationId, accessService: createWorkerAccessService() })
  }, [organizationId])

  if (!repository) {
    return <section role="alert" className="p-6 text-sm text-red-700">No se pudo preparar el acceso autorizado a trabajadores.</section>
  }

  return <WorkersWorkspace repository={repository} contextKey={`supabase:${organizationId}`} canManage mode="persistent" />
}
