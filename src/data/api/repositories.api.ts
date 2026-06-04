import { invokeEdge } from "../supabase/invokeEdge";

export type Repository = {
  id: string;           // id del vector store (OpenAI) o tu id interno
  nombre: string;
  creado_en?: string;
  meta?: Record<string, any>;
};

const EDGE = {
  create: "repos_create",
  remove: "repos_delete",
  add: "repos_add_files",
  detach: "repos_remove_files",
} as const;

export async function repos_create(payload: {
  nombre: string;
  descripcion?: string;
  /** si tu implementación crea también registro DB */
  persist?: boolean;
}): Promise<Repository> {
  return invokeEdge<Repository>(EDGE.create, payload);
}

export async function repos_delete(payload: { repoId: string }): Promise<{ ok: true }> {
  return invokeEdge<{ ok: true }>(EDGE.remove, payload);
}

/** Agrega archivos (OpenAI file ids) a un repositorio */
export async function repos_add_files(payload: {
  repoId: string;
  openaiFileIds: Array<string>;
}): Promise<{ ok: true }> {
  return invokeEdge<{ ok: true }>(EDGE.add, payload);
}

/** Quita archivos (OpenAI file ids) del repositorio */
export async function repos_remove_files(payload: {
  repoId: string;
  openaiFileIds: Array<string>;
}): Promise<{ ok: true }> {
  return invokeEdge<{ ok: true }>(EDGE.detach, payload);
}


export type BibliotecaSearchParams = {
  campo: string
  valor: string
}

export async function buscarBibliografia(
  payload: BibliotecaSearchParams
) {
  return invokeEdge<any>('biblioteca', payload)
}