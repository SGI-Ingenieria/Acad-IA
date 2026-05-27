import type { TipoAsignatura } from "./types";

export const ESTRUCTURAS_SEP = [
  { id: "sep-lic-2025", label: "Licenciatura SEP v2025" },
  { id: "sep-pos-2023", label: "Posgrado SEP v2023" },
  { id: "ulsa-int-2024", label: "Estándar Interno ULSA 2024" },
];

export const TIPOS_MATERIA: Array<{ value: TipoAsignatura; label: string }> = [
  { value: "OBLIGATORIA", label: "Obligatoria" },
  { value: "OPTATIVA", label: "Optativa" },
  { value: "TRONCAL", label: "Troncal / Eje común" },
  { value: "OTRA", label: "Otro" },
];

export const FACULTADES = [
  { id: "ing", nombre: "Facultad de Ingeniería" },
  { id: "med", nombre: "Facultad de Medicina" },
  { id: "neg", nombre: "Facultad de Negocios" },
];

export const CARRERAS = [
  { id: "sis", nombre: "Ing. en Sistemas", facultadId: "ing" },
  { id: "ind", nombre: "Ing. Industrial", facultadId: "ing" },
  { id: "medico", nombre: "Médico Cirujano", facultadId: "med" },
  { id: "act", nombre: "Actuaría", facultadId: "neg" },
];

export const PLANES_MOCK = [
  { id: "p1", nombre: "Plan 2010 Sistemas", carreraId: "sis" },
  { id: "p2", nombre: "Plan 2016 Sistemas", carreraId: "sis" },
  { id: "p3", nombre: "Plan 2015 Industrial", carreraId: "ind" },
];

export const MATERIAS_MOCK = [
  {
    id: "m1",
    nombre: "Programación Orientada a Objetos",
    creditos: 8,
    clave: "POO-101",
  },
  { id: "m2", nombre: "Cálculo Diferencial", creditos: 6, clave: "MAT-101" },
  { id: "m3", nombre: "Ética Profesional", creditos: 4, clave: "HUM-302" },
  {
    id: "m4",
    nombre: "Bases de Datos Avanzadas",
    creditos: 8,
    clave: "BD-201",
  },
];

export const ARCHIVOS_SISTEMA_MOCK = [
  { id: "doc1", name: "Sílabo_Base_Ingenieria.pdf" },
  { id: "doc2", name: "Competencias_Egreso_2025.docx" },
  { id: "doc3", name: "Reglamento_Academico.pdf" },
];
