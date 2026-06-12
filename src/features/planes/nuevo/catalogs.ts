import type { NivelPlanEstudio, TipoCiclo } from '@/data/types/domain'

import { Constants } from '@/types/supabase'

export const FACULTADES = [
  { id: 'ing', nombre: 'Facultad de Ingeniería' },
  {
    id: 'med',
    nombre: 'Facultad de Medicina en medicina en medicina en medicina',
  },
  { id: 'neg', nombre: 'Facultad de Negocios' },
]

export const CARRERAS = [
  { id: 'sis', nombre: 'Ing. en Sistemas', facultadId: 'ing' },
  { id: 'ind', nombre: 'Ing. Industrial', facultadId: 'ing' },
  { id: 'medico', nombre: 'Médico Cirujano', facultadId: 'med' },
  { id: 'act', nombre: 'Actuaría', facultadId: 'neg' },
]

// Derivados de los enums generados por Supabase (Constants) en lugar de
// listas hardcodeadas, para mantenerse en sincronía con la base de datos.
export const NIVELES: Array<NivelPlanEstudio> = [
  ...Constants.public.Enums.nivel_plan_estudio,
]

export const TIPOS_CICLO: Array<TipoCiclo> = [
  ...Constants.public.Enums.tipo_ciclo,
]

export const PLANES_EXISTENTES = [
  {
    id: 'plan-2021-sis',
    nombre: 'ISC 2021',
    estado: 'Aprobado',
    anio: 2021,
    facultadId: 'ing',
    carreraId: 'sis',
  },
  {
    id: 'plan-2020-ind',
    nombre: 'I. Industrial 2020',
    estado: 'Aprobado',
    anio: 2020,
    facultadId: 'ing',
    carreraId: 'ind',
  },
  {
    id: 'plan-2019-med',
    nombre: 'Medicina 2019',
    estado: 'Vigente',
    anio: 2019,
    facultadId: 'med',
    carreraId: 'medico',
  },
]

export const ARCHIVOS = [
  {
    id: 'file-1',
    nombre: 'Sílabo POO 2023.docx',
    tipo: 'docx',
    tamaño: '245 KB',
  },
  {
    id: 'file-2',
    nombre: 'Guía de prácticas BD.pdf',
    tipo: 'pdf',
    tamaño: '1.2 MB',
  },
  {
    id: 'file-3',
    nombre: 'Rúbrica evaluación proyectos.xlsx',
    tipo: 'xlsx',
    tamaño: '89 KB',
  },
  {
    id: 'file-4',
    nombre: 'Banco de reactivos IA.docx',
    tipo: 'docx',
    tamaño: '567 KB',
  },
  {
    id: 'file-5',
    nombre: 'Asignatural didáctico Web.pdf',
    tipo: 'pdf',
    tamaño: '3.4 MB',
  },
]

export const REPOSITORIOS: Array<{
  id: string
  nombre: string
  descripcion: string
  cantidadArchivos: number
}> = [
  // {
  //   id: 'repo-1',
  //   nombre: 'Asignaturales ISC 2024',
  //   descripcion: 'Documentos de referencia para Ingeniería en Sistemas',
  //   cantidadArchivos: 45,
  // },
  // {
  //   id: 'repo-2',
  //   nombre: 'Lineamientos SEP',
  //   descripcion: 'Documentos oficiales y normativas SEP actualizadas',
  //   cantidadArchivos: 12,
  // },
  // {
  //   id: 'repo-3',
  //   nombre: 'Bibliografía Digital',
  //   descripcion: 'Recursos bibliográficos digitalizados',
  //   cantidadArchivos: 128,
  // },
  // {
  //   id: 'repo-4',
  //   nombre: 'Plantillas Institucionales',
  //   descripcion: 'Formatos y plantillas oficiales ULSA',
  //   cantidadArchivos: 23,
  // },
]

export const PLANTILLAS_ANEXO_1 = [
  {
    id: 'sep-2025',
    name: 'Licenciatura RVOE SEP.docx',
    versions: ['v2025.2 (Vigente)', 'v2025.1', 'v2024.Final'],
  },
  {
    id: 'interno-mix',
    name: 'Estándar Institucional Mixto.docx',
    versions: ['v2.0', 'v1.5', 'v1.0-beta'],
  },
  {
    id: 'conacyt',
    name: 'Formato Posgrado CONAHCYT.docx',
    versions: ['v3.0 (2025)', 'v2.8'],
  },
]

export const PLANTILLAS_ANEXO_2 = [
  {
    id: 'sep-2017-xlsx',
    name: 'Licenciatura RVOE 2017.xlsx',
    versions: ['v2017.0', 'v2018.1', 'v2019.2', 'v2020.Final'],
  },
  {
    id: 'interno-mix-xlsx',
    name: 'Estándar Institucional Mixto.xlsx',
    versions: ['v1.0', 'v1.5'],
  },
  {
    id: 'conacyt-xlsx',
    name: 'Formato Posgrado CONAHCYT.xlsx',
    versions: ['v1.0', 'v2.0'],
  },
]
