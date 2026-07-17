import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useGeneratePitch() {
  return useMutation({
    mutationFn: (body: { leadId: string; productId?: string; instructions?: string }) => api.pitches.generate(body),
  });
}
