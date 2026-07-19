import { useState } from 'react'
import AuthShell from '../components/auth/AuthShell'
import Input from '../components/ui/Input'
import useAuth from '../hooks/useAuth'
import { hasValidationErrors, validateLoginForm } from '../utils/authValidation'

function Login({ onNavigate }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateLoginForm({ email, password })
    setErrors(nextErrors)

    if (hasValidationErrors(nextErrors)) {
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await signIn({ email, password })
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
          <span className="mb-2 block text-sm font-medium text-[#33443d]">Correo</span>
          <Input
            aria-label="Correo"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
          className="inline-flex w-full items-center justify-center rounded-md bg-[#C62828] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#B71C1C] focus:outline-none focus:ring-2 focus:ring-[#C62828] focus:ring-offset-2 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Iniciando...' : 'Iniciar sesion'}
        </button>
      </form>

      <div className="mt-5 flex flex-col gap-2 text-center text-sm">
        <button className="text-[#C62828] hover:underline" type="button" onClick={() => onNavigate('register')}>
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
