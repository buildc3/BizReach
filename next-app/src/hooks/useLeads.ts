import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useLeads(searchId: string) {
  return useQuery({
    queryKey: ["leads", searchId],
    queryFn: () => api.leads.list(searchId),
    enabled: !!searchId,
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ["leads", "detail", id],
    queryFn: () => api.leads.get(id),
    enabled: !!id,
  });
}
