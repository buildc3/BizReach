"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/useAuth";
import { loginFormSchema, type LoginFormInput } from "@/lib/form-schemas";

export default function LoginPage() {
  const login = useLogin();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
  });

  const onSubmit = (data: LoginFormInput) => login.mutate(data);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Welcome back to LeadGen.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" autoComplete="email" {...register("email")} placeholder="you@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          {login.isError && (
            <p className="text-xs text-destructive">
              {(login.error as { message?: string })?.message ?? "Invalid email or password"}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Log in
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-4">
          No account?{" "}
          <Link href="/signup" className="text-foreground underline underline-offset-2">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
