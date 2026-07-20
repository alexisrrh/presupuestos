import { COMPANY_NAME, LOGO_HORIZONTAL } from '../../config/branding'

function AuthShell({ children, subtitle, title }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-white px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-[#e5e7eb] bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={LOGO_HORIZONTAL}
            alt={`${COMPANY_NAME} logo`}
            className="h-20 w-64 max-w-full object-contain"
          />
          <h1 className="mt-5 text-2xl font-semibold text-[#111827]">{title}</h1>
          <p className="mt-2 text-sm text-[#6b7280]">{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  )
}

export default AuthShell
