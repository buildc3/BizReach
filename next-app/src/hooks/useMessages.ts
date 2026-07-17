import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
