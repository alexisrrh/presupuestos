import Input from '../ui/Input'
import { Field, TextareaField } from './SettingsFields'

function DefaultValuesSection({ data, onChange }) {
  return (
    <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-[#e5e7eb] pb-4">
        <h2 className="text-lg font-semibold text-[#111827]">
          Valores predeterminados
        </h2>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="IVA">
          <Input
            min="0"
            step="0.01"
            type="number"
            value={data.defaultVat}
            onChange={(event) => onChange('defaultVat', event.target.value)}
          />
        </Field>
        <Field label="Validez del presupuesto en dias">
          <Input
            min="0"
            step="1"
            type="number"
            value={data.defaultValidityDays}
            onChange={(event) => onChange('defaultValidityDays', event.target.value)}
          />
        </Field>
        <TextareaField
          label="Forma de pago"
          value={data.defaultPaymentTerms}
          onChange={(value) => onChange('defaultPaymentTerms', value)}
        />
        <TextareaField
          label="Plazo de ejecucion"
          value={data.defaultExecutionTime}
          onChange={(value) => onChange('defaultExecutionTime', value)}
        />
        <div className="sm:col-span-2">
          <TextareaField
            label="Observaciones"
            value={data.defaultObservations}
            onChange={(value) => onChange('defaultObservations', value)}
          />
        </div>
      </div>
    </section>
  )
}

export default DefaultValuesSection
