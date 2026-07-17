import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useWhatsAppStatus() {
  return useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: api.whatsapp.status,
    refetchInterval: 3000, // poll every 3s while waiting for QR scan
  });
}

export function useWhatsAppLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.whatsapp.logout,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-status"] }),
  });
}
