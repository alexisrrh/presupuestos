import { useCallback, useEffect, useRef, useState } from 'react'
import { createTimeTrackingService, TimeTrackingError } from '../services/timeTracking/timeTrackingService'

export default function useTimeTracking({ enabled, sessionUserId }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState(enabled ? 'loading' : 'idle')
  const [message, setMessage] = useState('')
  const requestVersion = useRef(0)
  const mutationInFlight = useRef(false)
  const [service] = useState(() => createTimeTrackingService())

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current
    if (!enabled || !sessionUserId) { setData(null); setStatus('idle'); return null }
    setStatus('loading')
    try {
      const next = await service.load()
      if (version === requestVersion.current) { setData(next); setStatus('ready'); setMessage('') }
      return next
    } catch (error) {
      if (version !== requestVersion.current) return null
      setData(null)
      setStatus(error instanceof TimeTrackingError && error.code === 'FORBIDDEN' ? 'forbidden' : 'error')
      setMessage(error.message)
      return null
    }
  }, [enabled, service, sessionUserId])

  useEffect(() => {
    queueMicrotask(refresh)
    return () => { requestVersion.current += 1 }
  }, [refresh])
  useEffect(() => {
    const recover = () => refresh()
    const visibility = () => { if (document.visibilityState === 'visible') recover() }
    window.addEventListener('online', recover)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('online', recover); document.removeEventListener('visibilitychange', visibility) }
  }, [refresh])

  const clock = useCallback(async () => {
    if (!data?.state || status === 'sending' || mutationInFlight.current) return null
    mutationInFlight.current = true
    const version = ++requestVersion.current
    const isOpen = data.state.session_status === 'open'
    setStatus('sending'); setMessage('')
    try {
      const result = isOpen ? await service.clockOut() : await service.clockIn()
      // A response can be valid yet reject a normal transition. Always reload
      // persisted state; never retry a mutation after uncertainty.
      const next = await service.load()
      if (version === requestVersion.current) {
        setData(next); setStatus('ready')
        setMessage(result?.accepted ? (isOpen ? 'Salida registrada.' : 'Entrada registrada.') : 'El estado ya había cambiado. Se ha actualizado la jornada.')
      }
      return result
    } catch (error) {
      if (version === requestVersion.current) {
        setStatus(error instanceof TimeTrackingError && error.code === 'UNCERTAIN' ? 'uncertain' : 'error')
        setMessage(error.message)
        // State is explicitly not guessed. The user can refresh after a lost response.
      }
      return null
    } finally { mutationInFlight.current = false }
  }, [data, service, status])

  return { data, status, message, refresh, clock }
}
