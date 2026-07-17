import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SendPitchInput } from "@/lib/schemas";

export function useMessages(leadId?: string) {
  return useQuery({
    queryKey: ["messages", leadId ?? "all"],
    queryFn: () => api.messages.list(leadId),
  });
}

export function useFollowups(olderThanDays = 3) {
  return useQuery({
    queryKey: ["followups", olderThanDays],
    queryFn: () => api.messages.followups(olderThanDays),
    refetchInterval: 60_000, // refresh every minute
  });
}

export function useSendPitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SendPitchInput) => api.messages.send(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["messages", vars.leadId] });
      qc.invalidateQueries({ queryKey: ["followups"] });
    },
  });
}
