import { useMutation, useQueryClient } from "@tanstack/react-query";

import { buscarBibliografia, repos_add_files, repos_create, repos_delete, repos_remove_files } from "../api/repositories.api";

export function useCreateRepository() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: repos_create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repos"] });
    },
  });
}

export function useDeleteRepository() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: repos_delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repos"] });
    },
  });
}

export function useRepoAddFiles() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: repos_add_files,
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({ queryKey: ["repos", vars.repoId] });
    },
  });
}

export function useRepoRemoveFiles() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: repos_remove_files,
    onSuccess: (_ok, vars) => {
      qc.invalidateQueries({ queryKey: ["repos", vars.repoId] });
    },
  });
}


export function useBuscarBibliografia() {
  return useMutation({
    mutationFn: buscarBibliografia,
  })
}