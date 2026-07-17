import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useGroups(searchId: string) {
  return useQuery({
    queryKey: ["groups", searchId],
    queryFn: () => api.groups.list(searchId),
    enabled: !!searchId,
  });
}

/** Invalidate both the groups list and the leads list for a search. */
function useGroupInvalidator(searchId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["groups", searchId] });
    qc.invalidateQueries({ queryKey: ["leads", searchId] });
  };
}

export function useAutoGroup(searchId: string) {
  const invalidate = useGroupInvalidator(searchId);
  return useMutation({
    mutationFn: () => api.groups.autoGroup(searchId),
    onSuccess: invalidate,
  });
}

export function useCreateGroup(searchId: string) {
  const invalidate = useGroupInvalidator(searchId);
  return useMutation({
    mutationFn: (name: string) => api.groups.create(searchId, name),
    onSuccess: invalidate,
  });
}

export function useRenameGroup(searchId: string) {
  const invalidate = useGroupInvalidator(searchId);
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.groups.rename(id, name),
    onSuccess: invalidate,
  });
}

export function useDeleteGroup(searchId: string) {
  const invalidate = useGroupInvalidator(searchId);
  return useMutation({
    mutationFn: (id: string) => api.groups.delete(id),
    onSuccess: invalidate,
  });
}

export function useMoveLead(searchId: string) {
  const invalidate = useGroupInvalidator(searchId);
  return useMutation({
    mutationFn: ({ leadId, groupId }: { leadId: string; groupId: string | null }) =>
      api.leads.moveGroup(leadId, groupId),
    onSuccess: invalidate,
  });
}
