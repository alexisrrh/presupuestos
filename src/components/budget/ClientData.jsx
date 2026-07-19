import Input from '../ui/Input'

function ClientData({ data, onChange }) {
  return (
    <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-[#e3e8e5] pb-4">
        <h2 className="text-lg font-semibold text-[#111827]">Datos del cliente</h2>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            Nombre o razon social
          </span>
          <Input
            value={data.name}
            onChange={(event) => onChange('name', event.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            DNI, NIE o CIF
          </span>
          <Input
            value={data.taxId}
            onChange={(event) => onChange('taxId', event.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            Telefono
          </span>
          <Input
            type="tel"
            value={data.phone}
            onChange={(event) => onChange('phone', event.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            Correo electronico
          </span>
          <Input
            type="email"
            value={data.email}
            onChange={(event) => onChange('email', event.target.value)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-medium text-[#33443d]">
            Direccion
          </span>
          <Input
            value={data.address}
            onChange={(event) => onChange('address', event.target.value)}
          />
        </label>
      </div>
    </section>
  )
}

export default ClientData
