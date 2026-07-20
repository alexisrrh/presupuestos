import { useState } from 'react'
import AuthShell from '../components/auth/AuthShell'
import Input from '../components/ui/Input'
import useAuth from '../hooks/useAuth'
import { validateEmail } from '../utils/authValidation'

function ForgotPassword({ onNavigate }) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const emailError = validateEmail(email)

    if (emailError) {
      setError(emailError)
      return
    }

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await resetPassword(email, window.location.origin)
      setSuccess('Enlace enviado si el correo existe en Supabase.')
    } catch (authError) {
      setError(authError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Recibe un enlace para restablecer el acceso.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">Correo</span>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {error && <p className="rounded-md bg-[#fff5f5] p-3 text-sm text-[#991b1b]">{error}</p>}
        {success && <p className="rounded-md bg-[#f3fbf6] p-3 text-sm text-[#166534]">{success}</p>}
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-md bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-navy-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)] focus:ring-offset-2 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar enlace'}
        </button>
      </form>
      <button className="mt-5 w-full text-center text-sm text-[var(--brand-navy)] hover:underline" type="button" onClick={() => onNavigate('login')}>
        Volver a iniciar sesion
      </button>
    </AuthShell>
  )
}

export default ForgotPassword
