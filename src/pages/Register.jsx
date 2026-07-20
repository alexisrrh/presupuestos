import { useState } from 'react'
import AuthShell from '../components/auth/AuthShell'
import Input from '../components/ui/Input'
import useAuth from '../hooks/useAuth'
import { hasValidationErrors, validateRegisterForm } from '../utils/authValidation'

function Register({ onNavigate }) {
  const { signUp } = useAuth()
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [fullName, setFullName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateRegisterForm({
      confirmPassword,
      email,
      fullName,
      password,
    })
    setErrors(nextErrors)

    if (hasValidationErrors(nextErrors)) {
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await signUp({ email, fullName, password })
      setSuccess('Cuenta creada. Revisa tu correo si Supabase requiere confirmacion.')
    } catch (authError) {
      setError(authError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Crear cuenta" subtitle="Registra tu usuario para PRITECA.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">Nombre</span>
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          {errors.fullName && <p className="mt-1 text-sm text-[#991b1b]">{errors.fullName}</p>}
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">Correo</span>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          {errors.email && <p className="mt-1 text-sm text-[#991b1b]">{errors.email}</p>}
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">Contraseña</span>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {errors.password && <p className="mt-1 text-sm text-[#991b1b]">{errors.password}</p>}
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">Confirmar contraseña</span>
          <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          {errors.confirmPassword && <p className="mt-1 text-sm text-[#991b1b]">{errors.confirmPassword}</p>}
        </label>

        {error && <p className="rounded-md bg-[#fff5f5] p-3 text-sm text-[#991b1b]">{error}</p>}
        {success && <p className="rounded-md bg-[#f3fbf6] p-3 text-sm text-[#166534]">{success}</p>}

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-navy-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Registrando...' : 'Registrarse'}
        </button>
      </form>

      <button className="mt-5 w-full text-center text-sm text-[var(--brand-navy)] hover:underline" type="button" onClick={() => onNavigate('login')}>
        Ya tengo cuenta
      </button>
    </AuthShell>
  )
}

export default Register
