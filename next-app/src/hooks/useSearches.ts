import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NewSearchInput } from "@/lib/form-schemas";

export function useSearches() {
  return useQuery({
    queryKey: ["searches"],
    queryFn: api.searches.list,
    // While any scrape is running, poll so the status flips to done/error live.
    refetchInterval: (query) =>
      query.state.data?.some((s) => s.status === "running") ? 3000 : false,
  });
}

export function useSearch(id: string) {
  return useQuery({ queryKey: ["searches", id], queryFn: () => api.searches.get(id) });
}

export function useCreateSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NewSearchInput) => api.searches.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["searches"] }),
  });
}

export function useRunSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.searches.run(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["searches"] });
      qc.invalidateQueries({ queryKey: ["leads", id] });
    },
  });
}

export function useDeleteSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.searches.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["searches"] }),
  });
}
