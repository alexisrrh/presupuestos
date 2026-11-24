import { Clock3, RefreshCw } from 'lucide-react'
import useTimeTracking from '../hooks/useTimeTracking'
import { createWorkerAccessService } from '../services/workers/workerAccessService'
import { useState } from 'react'

const madridDate = new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeZone: 'Europe/Madrid' })
const madridTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })

function formatTime(value) { return value ? madridTime.format(new Date(value)) : '—' }

function EmployeeArea({ user, onSignOut }) {
  const { clock, data, message, refresh, status } = useTimeTracking({ enabled: Boolean(user?.id), sessionUserId: user?.id })
  const state = data?.state
  const open = state?.session_status === 'open'
  const busy = status === 'sending' || status === 'loading'
  const [password, setPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  async function changePassword(event) {
    event.preventDefault()
    if (password.length < 8) return
    setPasswordBusy(true); setPasswordMessage('')
    try { await createWorkerAccessService().changePassword(password); setPassword(''); setPasswordMessage('Contraseña actualizada correctamente.') }
    catch (error) { setPasswordMessage(error.message || 'No se pudo actualizar la contraseña.') }
    finally { setPasswordBusy(false) }
  }

  return (
    <main className="min-h-svh bg-[#f5f7f6] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-[#1f2933] sm:px-6">
      <div className="mx-auto max-w-lg space-y-5">
        <header className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#60706a]">Mi jornada</p><h1 className="mt-1 text-2xl font-semibold">Fichaje</h1></div><div className="flex gap-2"><button type="button" onClick={onSignOut} className="min-h-11 rounded-full border border-[#d8dfdb] bg-white px-3 text-sm font-semibold text-[#174f46]">Cerrar sesión</button><button type="button" aria-label="Actualizar jornada" onClick={refresh} disabled={busy} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#d8dfdb] bg-white text-[#174f46] disabled:opacity-50"><RefreshCw size={19} aria-hidden="true" /></button></div></header>
        {status === 'loading' && <p role="status" className="rounded-2xl bg-white p-5 text-sm text-[#60706a]">Comprobando tu jornada…</p>}
        {status === 'forbidden' && <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">Fichaje no disponible</h2><p className="mt-2 text-sm text-[#675b20]">{message}</p></section>}
        {(status === 'error' || status === 'uncertain') && <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5"><h2 className="font-semibold">Resultado pendiente de comprobar</h2><p className="mt-2 text-sm text-red-800">{message}</p><button type="button" onClick={refresh} className="mt-3 min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-[#174f46]">Actualizar estado</button></section>}
        {state && <><section className="rounded-3xl bg-[#174f46] p-6 text-white shadow-lg"><p className="text-sm text-white/75">{madridDate.format(new Date())}</p><h2 className="mt-4 text-2xl font-semibold">{state.first_name} {state.last_name}</h2><p className="mt-1 text-sm text-white/75">{state.employee_code}</p><div className="mt-7 rounded-2xl bg-white/10 p-4"><p className="text-sm text-white/75">Estado actual</p><p className="mt-1 text-lg font-semibold">{open ? 'Jornada en curso' : 'Sin jornada abierta'}</p>{open && <p className="mt-1 text-sm text-white/80">Entrada: {formatTime(state.clock_in_at)}</p>}</div><button type="button" onClick={clock} disabled={busy} className="mt-6 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#f58220] px-5 text-lg font-bold text-white shadow-sm transition hover:bg-[#de6c0f] disabled:cursor-wait disabled:opacity-60"><Clock3 size={23} aria-hidden="true" />{busy ? 'Registrando…' : open ? 'Registrar salida' : 'Registrar entrada'}</button>{message && status === 'ready' && <p role="status" className="mt-4 text-sm text-white/90">{message}</p>}</section>
        <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-base font-semibold">Últimas jornadas</h2><ul className="mt-3 space-y-3">{data.history.length ? data.history.map((session) => <li key={session.session_id} className="flex items-center justify-between border-b border-[#edf0ee] pb-3 text-sm last:border-0 last:pb-0"><span>{session.session_status === 'open' ? 'En curso' : 'Finalizada'}<br /><span className="text-[#60706a]">Entrada {formatTime(session.clock_in_at)}</span></span><span className="text-right text-[#60706a]">{session.clock_out_at ? `Salida ${formatTime(session.clock_out_at)}` : 'Pendiente'}</span></li>) : <li className="text-sm text-[#60706a]">Todavía no hay jornadas registradas.</li>}</ul></section></>}
        {state && <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-base font-semibold">Seguridad</h2><form className="mt-3 space-y-3" onSubmit={changePassword}><label className="block text-sm font-medium">Nueva contraseña<input className="mt-1 min-h-11 w-full rounded-lg border border-[#d8dfdb] px-3" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label><button type="submit" disabled={passwordBusy || password.length < 8} className="min-h-11 rounded-lg bg-[#174f46] px-4 text-sm font-semibold text-white disabled:opacity-50">{passwordBusy ? 'Actualizando…' : 'Cambiar contraseña'}</button>{passwordMessage && <p role="status" className="text-sm text-[#60706a]">{passwordMessage}</p>}</form></section>}
      </div>
    </main>
  )
}

export default EmployeeArea
