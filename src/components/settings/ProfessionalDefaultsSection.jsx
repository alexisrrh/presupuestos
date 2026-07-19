import ListFieldEditor from '../budget/ListFieldEditor'
import { TextareaField } from './SettingsFields'

function ProfessionalDefaultsSection({ data, onChange }) {
  const defaults = data.professionalDefaults || {}

  const updateDefaults = (field, value) => {
    onChange('professionalDefaults', {
      ...defaults,
      [field]: value,
    })
  }

  return (
    <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-[#e5e7eb] pb-4">
        <h2 className="text-lg font-semibold text-[#111827]">
          Presupuesto profesional
        </h2>
      </div>
      <div className="mt-5 space-y-5">
        <TextareaField
          label="Frase corporativa"
          value={defaults.tagline || ''}
          onChange={(value) => updateDefaults('tagline', value)}
        />
        <TextareaField
          label="Resumen ejecutivo predeterminado"
          value={defaults.executiveSummary || ''}
          onChange={(value) => updateDefaults('executiveSummary', value)}
        />
        <TextareaField
          label="Solucion recomendada predeterminada"
          value={defaults.recommendedSolution || ''}
          onChange={(value) => updateDefaults('recommendedSolution', value)}
        />
        <ListFieldEditor
          label="Alcance general predeterminado"
          value={defaults.generalScope || []}
          onChange={(value) => updateDefaults('generalScope', value)}
        />
        <TextareaField
          label="Condicionantes de partida"
          value={defaults.startingConditions || ''}
          onChange={(value) => updateDefaults('startingConditions', value)}
        />
        <ListFieldEditor
          label="Condiciones economicas"
          value={defaults.economicConditions || []}
          onChange={(value) => updateDefaults('economicConditions', value)}
        />
        <ListFieldEditor
          label="Inclusiones"
          value={defaults.inclusions || []}
          onChange={(value) => updateDefaults('inclusions', value)}
        />
        <ListFieldEditor
          label="Exclusiones"
          value={defaults.exclusions || []}
          onChange={(value) => updateDefaults('exclusions', value)}
        />
        <TextareaField
          label="Garantia"
          value={defaults.warranty || ''}
          onChange={(value) => updateDefaults('warranty', value)}
        />
        <ListFieldEditor
          label="Documentacion de cierre"
          value={defaults.closingDocumentation || []}
          onChange={(value) => updateDefaults('closingDocumentation', value)}
        />
      </div>
    </section>
  )
}

export default ProfessionalDefaultsSection
