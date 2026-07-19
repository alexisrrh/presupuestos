import Input from '../ui/Input'
import { Field } from './SettingsFields'

function CompanyDataSection({ data, onChange }) {
  return (
    <section className="rounded-md border border-[#d8dfdb] bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-[#e5e7eb] pb-4">
        <h2 className="text-lg font-semibold text-[#111827]">Datos de la empresa</h2>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nombre comercial">
          <Input value={data.name} onChange={(event) => onChange('name', event.target.value)} />
        </Field>
        <Field label="Razon social">
          <Input value={data.legalName} onChange={(event) => onChange('legalName', event.target.value)} />
        </Field>
        <Field label="CIF">
          <Input value={data.taxId} onChange={(event) => onChange('taxId', event.target.value)} />
        </Field>
        <Field label="Telefono">
          <Input value={data.phone} onChange={(event) => onChange('phone', event.target.value)} />
        </Field>
        <Field label="Correo">
          <Input type="email" value={data.email} onChange={(event) => onChange('email', event.target.value)} />
        </Field>
        <Field label="Pagina web">
          <Input value={data.website} onChange={(event) => onChange('website', event.target.value)} />
        </Field>
        <Field label="Direccion">
          <Input value={data.address} onChange={(event) => onChange('address', event.target.value)} />
        </Field>
        <Field label="IBAN">
          <Input value={data.iban} onChange={(event) => onChange('iban', event.target.value)} />
        </Field>
      </div>
    </section>
  )
}

export default CompanyDataSection
