import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SenderProfile } from "@/types";

export function useProfile() {
  return useQuery({
    queryKey: ["sender-profile"],
    queryFn: api.settings.getProfile,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<SenderProfile, "yourName" | "companyName" | "phone" | "website">>) =>
      api.settings.updateProfile(body),
    onSuccess: (updated) => {
      qc.setQueryData(["sender-profile"], updated);
    },
  });
}
