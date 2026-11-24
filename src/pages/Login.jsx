import { useState } from 'react'
import AuthShell from '../components/auth/AuthShell'
import Input from '../components/ui/Input'
import useAuth from '../hooks/useAuth'
import { hasValidationErrors, validateLoginForm } from '../utils/authValidation'
import { createWorkerAccessService } from '../services/workers/workerAccessService'

function Login({ onNavigate }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [documentLogin, setDocumentLogin] = useState(false)
  const [document, setDocument] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = documentLogin ? {} : validateLoginForm({ email, password })
    setErrors(nextErrors)

    if (hasValidationErrors(nextErrors)) {
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      if (documentLogin) await createWorkerAccessService().signInWithDocument(document, password)
      else await signIn({ email, password })
    } catch (authError) {
      setError(authError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Iniciar sesion"
      subtitle="Accede para sincronizar presupuestos con Supabase."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#33443d]">{documentLogin ? 'DNI/NIE' : 'Correo'}</span>
          <Input
            aria-label={documentLogin ? 'DNI/NIE' : 'Correo'}
            type={documentLogin ? 'text' : 'email'}
            value={documentLogin ? document : email}
            onChange={(event) => documentLogin ? setDocument(event.target.value) : setEmail(event.target.value)}
          />
          {errors.email && <p className="mt-1 text-sm text-[#991b1b]">{errors.email}</p>}
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            Contraseña
          </span>
          <Input
            aria-label="Contraseña"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-[#991b1b]">{errors.password}</p>
          )}
        </label>

        {error && <p className="rounded-md bg-[#fff5f5] p-3 text-sm text-[#991b1b]">{error}</p>}

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-navy-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Iniciando...' : 'Iniciar sesion'}
        </button>
      </form>

      <div className="mt-5 flex flex-col gap-2 text-center text-sm">
        <button className="text-[var(--brand-navy)] hover:underline" type="button" onClick={() => { setDocumentLogin((value) => !value); setError(''); setErrors({}) }}>
          {documentLogin ? 'Acceder con correo de administrador' : 'Acceder como trabajador con DNI/NIE'}
        </button>
        <button className="text-[var(--brand-navy)] hover:underline" type="button" onClick={() => onNavigate('register')}>
          Crear cuenta
        </button>
        <button className="text-[#6b7280] hover:text-[#111827] hover:underline" type="button" onClick={() => onNavigate('forgot-password')}>
          He olvidado mi contraseña
        </button>
      </div>
    </AuthShell>
  )
}

export default Login
