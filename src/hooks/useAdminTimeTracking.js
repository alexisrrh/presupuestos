import { useCallback, useEffect, useRef, useState } from 'react'
import { AdminTimeTrackingError, createAdminTimeTrackingService } from '../services/timeTracking/adminTimeTrackingService'

export default function useAdminTimeTracking({ enabled }) {
  const [sessions, setSessions] = useState([])
  const [filters, setFilters] = useState({ workerId: '', from: '', to: '', status: '' })
  const [status, setStatus] = useState(enabled ? 'loading' : 'idle')
  const [message, setMessage] = useState('')
  const requestVersion = useRef(0)
  const mutationInFlight = useRef(false)
  const [service] = useState(() => createAdminTimeTrackingService())

  const refresh = useCallback(async (nextFilters = filters) => {
    const version = ++requestVersion.current
    if (!enabled) { setSessions([]); setStatus('idle'); return [] }
    setStatus('loading')
    try {
      const rows = await service.list(nextFilters)
      if (version === requestVersion.current) { setSessions(rows); setStatus('ready'); setMessage('') }
      return rows
    } catch (error) {
      if (version === requestVersion.current) {
        setStatus(error instanceof AdminTimeTrackingError && error.code === 'FORBIDDEN' ? 'forbidden' : 'error')
        setMessage(error.message)
      }
      return []
    }
  }, [enabled, filters, service])

  useEffect(() => { queueMicrotask(() => refresh()); return () => { requestVersion.current += 1 } }, [refresh])

  const applyFilters = useCallback((nextFilters) => {
    setFilters(nextFilters)
    return refresh(nextFilters)
  }, [refresh])

  const update = useCallback(async (proposal) => {
    if (mutationInFlight.current) return { kind: 'ignored' }
    mutationInFlight.current = true
    setStatus('sending'); setMessage('')
    try {
      const saved = await service.update(proposal)
      await refresh()
      setStatus('ready')
      return { kind: 'saved', saved }
    } catch (error) {
      const mapped = error instanceof AdminTimeTrackingError ? error : new AdminTimeTrackingError('UNKNOWN', 'No se pudo guardar la jornada.')
      // A conflict or lost response is reconciled by reading, never by replaying
      // a correction. The draft remains in the component for review.
      if (mapped.code === 'CONFLICT' || mapped.code === 'UNCERTAIN') await refresh()
      setStatus(mapped.code === 'UNCERTAIN' ? 'uncertain' : 'error')
      setMessage(mapped.message)
      return { kind: 'error', error: mapped }
    } finally {
      mutationInFlight.current = false
    }
  }, [refresh, service])

  return { applyFilters, filters, message, refresh, sessions, setFilters, status, update }
}
