import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PitchMode } from "@/types";

/** Pitches for a group. Pass `poll` to auto-refetch while generation runs. */
export function useGroupPitches(groupId: string, poll = false) {
  return useQuery({
    queryKey: ["pitches", groupId],
    queryFn: () => api.pitches.listByGroup(groupId),
    enabled: !!groupId,
    // Poll fast while generating; slower while sends are queued so statuses settle on screen.
    refetchInterval: (q) => (poll ? 1500 : q.state.data?.some((p) => p.status === "queued") ? 5000 : false),
  });
}

function useInvalidatePitches(groupId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["pitches", groupId] });
}

export function useGenerateBatch(groupId: string) {
  const invalidate = useInvalidatePitches(groupId);
  return useMutation({
    mutationFn: (body: { mode: PitchMode; templateId?: string; productId?: string; instructions?: string }) =>
      api.pitches.generateBatch({ groupId, ...body }),
    onSuccess: invalidate,
  });
}

export function useUpdatePitch(groupId: string) {
  const invalidate = useInvalidatePitches(groupId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.pitches.update(id, body),
    onSuccess: invalidate,
  });
}

export function useReviewPitch(groupId: string) {
  const invalidate = useInvalidatePitches(groupId);
  return useMutation({
    mutationFn: (id: string) => api.pitches.review(id),
    onSuccess: invalidate,
  });
}

export function useRejectPitch(groupId: string) {
  const invalidate = useInvalidatePitches(groupId);
  return useMutation({
    mutationFn: (id: string) => api.pitches.reject(id),
    onSuccess: invalidate,
  });
}

export function useResendPitch(groupId: string) {
  const invalidate = useInvalidatePitches(groupId);
  return useMutation({
    mutationFn: (id: string) => api.pitches.resend(id),
    onSuccess: invalidate,
  });
}

export function useSendGroup(groupId: string) {
  const invalidate = useInvalidatePitches(groupId);
  return useMutation({
    mutationFn: () => api.pitches.sendGroup(groupId),
    onSuccess: invalidate,
  });
}
