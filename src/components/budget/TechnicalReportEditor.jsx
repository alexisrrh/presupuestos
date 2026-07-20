import ListFieldEditor from './ListFieldEditor'

function Textarea({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#33443d]">{label}</span>
      <textarea
        className="min-h-24 w-full resize-y rounded-md border border-[#ccd6d1] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function Input({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#33443d]">{label}</span>
      <input
        className="w-full rounded-md border border-[#ccd6d1] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[var(--brand-navy)] focus:ring-2 focus:ring-[var(--brand-navy)]/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function TechnicalReportEditor({ data, onChange }) {
  return (
    <section className="space-y-6 rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-[#e5e7eb] pb-4">
        <h2 className="text-lg font-semibold text-[#111827]">Memoria tecnica</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Objeto de la oferta" value={data.offerObject} onChange={(value) => onChange('offerObject', value)} />
        <Input label="Persona de contacto" value={data.contactPerson} onChange={(value) => onChange('contactPerson', value)} />
        <Input label="Tecnico responsable" value={data.responsibleTechnician} onChange={(value) => onChange('responsibleTechnician', value)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea label="Resumen ejecutivo" value={data.executiveSummary} onChange={(value) => onChange('executiveSummary', value)} />
        <Textarea label="Solucion recomendada" value={data.recommendedSolution} onChange={(value) => onChange('recommendedSolution', value)} />
      </div>

      <ListFieldEditor label="Alcance general" value={data.generalScope} onChange={(value) => onChange('generalScope', value)} />
      <Textarea label="Condicionantes de partida" value={data.startingConditions} onChange={(value) => onChange('startingConditions', value)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Inicio estimado" value={data.estimatedStart} onChange={(value) => onChange('estimatedStart', value)} />
        <Input label="Duracion estimada" value={data.estimatedDuration} onChange={(value) => onChange('estimatedDuration', value)} />
        <Input label="Horario previsto" value={data.expectedSchedule} onChange={(value) => onChange('expectedSchedule', value)} />
        <Input label="Condicionantes de planificacion" value={data.planningConditions} onChange={(value) => onChange('planningConditions', value)} />
      </div>

      <ListFieldEditor label="Condiciones economicas" value={data.economicConditions} onChange={(value) => onChange('economicConditions', value)} />
      <ListFieldEditor label="Inclusiones" value={data.inclusions} onChange={(value) => onChange('inclusions', value)} />
      <ListFieldEditor label="Exclusiones" value={data.exclusions} onChange={(value) => onChange('exclusions', value)} />
      <Textarea label="Garantia" value={data.warranty} onChange={(value) => onChange('warranty', value)} />
      <ListFieldEditor label="Documentacion de cierre" value={data.closingDocumentation} onChange={(value) => onChange('closingDocumentation', value)} />
      <Textarea label="Descripcion personalizada del metodo PRITECA" value={data.customMethodDescription} onChange={(value) => onChange('customMethodDescription', value)} />
    </section>
  )
}

export default TechnicalReportEditor
