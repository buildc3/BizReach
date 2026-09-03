import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: api.auth.me,
    retry: false,
  });
}

export function useSignup() {
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.auth.signup,
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      router.push("/");
    },
  });
}

export function useLogin() {
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.auth.login,
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      router.push("/");
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      qc.clear();
      router.push("/login");
    },
  });
}
