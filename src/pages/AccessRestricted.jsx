function AccessRestricted({ status }) {
  const message = status === 'organization-selection-required'
    ? 'Tu cuenta pertenece a varias organizaciones. La selección explícita estará disponible próximamente.'
    : 'Tu cuenta no tiene una membresía activa con acceso a esta área.'
  return <main className="mx-auto max-w-xl p-8 text-center"><h1 className="text-xl font-semibold">Acceso no disponible</h1><p className="mt-3 text-sm text-[#60706a]">{message}</p></main>
}

export default AccessRestricted
