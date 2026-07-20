import { LOGO_HORIZONTAL } from '../config/branding'

export const companyData = {
  name: 'PRITECA',
  legalName: 'PRITECA Construcciones',
  taxId: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  iban: '',
  defaultVat: 21,
  defaultValidityDays: 30,
  defaultPaymentTerms: '',
  defaultExecutionTime: '',
  defaultObservations: '',
  logo: LOGO_HORIZONTAL,
  professionalDefaults: {
    tagline: 'La ingenieria convierte la complejidad en claridad.',
    executiveSummary: '',
    recommendedSolution: '',
    generalScope: [
      'Protecciones, medios auxiliares y retirada de residuos',
      'Pruebas, limpieza y entrega documental',
    ],
    startingConditions:
      'La oferta se formula con base en la informacion visible y disponible en la fecha de emision. Los elementos ocultos, interferencias no detectables o cambios posteriores podran requerir una valoracion complementaria.',
    economicConditions: [
      'La aceptacion se formalizara mediante firma, correo inequivoco o pago del anticipo indicado.',
      'Los trabajos adicionales requeriran autorizacion previa mediante presupuesto complementario u orden de cambio.',
      'La oferta tendra la vigencia indicada en portada. Transcurrido ese plazo, precios y disponibilidad podran revisarse.',
    ],
    inclusions: [
      'Salvo indicacion expresa en las partidas, se consideran incluidos los medios ordinarios necesarios para la correcta ejecucion, protecciones basicas, herramientas, transporte, retirada de residuos generados y limpieza final del area de trabajo.',
    ],
    exclusions: [
      'Licencias, tasas, proyectos visados o permisos administrativos, salvo inclusion expresa.',
      'Trabajos sobre elementos ocultos o danos no detectables durante la inspeccion inicial.',
      'Retirada o tratamiento de materiales peligrosos.',
      'Actuaciones en instalaciones ajenas al alcance descrito.',
      'Modificaciones solicitadas despues de la aceptacion.',
    ],
    warranty:
      'Los trabajos ejecutados estaran cubiertos por la garantia legal y por las condiciones especificas indicadas en la oferta. La garantia no cubrira danos derivados de uso inadecuado, manipulacion por terceros, falta de mantenimiento o causas externas a la actuacion realizada.',
    closingDocumentation: [
      'Acta de entrega',
      'Relacion de trabajos ejecutados',
      'Reportaje fotografico',
      'Fichas tecnicas',
      'Certificados y garantias',
      'Pruebas realizadas',
      'Recomendaciones de mantenimiento',
    ],
  },
}
