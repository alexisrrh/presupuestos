import Input from '../ui/Input'

function BudgetGeneralData({ data, onChange }) {
  return (
    <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-[#e3e8e5] pb-4">
        <h2 className="text-lg font-semibold text-[#111827]">Datos generales</h2>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            Numero de presupuesto
          </span>
          <Input
            value={data.number}
            onChange={(event) => onChange('number', event.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            Fecha
          </span>
          <Input
            type="date"
            value={data.date}
            onChange={(event) => onChange('date', event.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            Validez en dias
          </span>
          <Input
            min="0"
            type="number"
            value={data.validityDays}
            onChange={(event) => onChange('validityDays', event.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            Nombre de la obra
          </span>
          <Input
            value={data.projectName}
            placeholder="Ej. Reforma vivienda"
            onChange={(event) => onChange('projectName', event.target.value)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            Direccion de la obra
          </span>
          <Input
            value={data.projectAddress}
            placeholder="Direccion completa"
            onChange={(event) => onChange('projectAddress', event.target.value)}
          />
        </label>
      </div>
    </section>
  )
}

export default BudgetGeneralData
