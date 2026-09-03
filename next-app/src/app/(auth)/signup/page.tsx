"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignup } from "@/hooks/useAuth";
import { signupFormSchema, type SignupFormInput } from "@/lib/form-schemas";

export default function SignupPage() {
  const signup = useSignup();
  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormInput>({
    resolver: zodResolver(signupFormSchema),
  });

  const onSubmit = (data: SignupFormInput) => signup.mutate(data);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Set up your LeadGen workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Name (optional)</Label>
            <Input {...register("name")} placeholder="Your name" />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" autoComplete="email" {...register("email")} placeholder="you@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input type="password" autoComplete="new-password" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          {signup.isError && (
            <p className="text-xs text-destructive">
              {(signup.error as { message?: string })?.message ?? "Could not create account"}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={signup.isPending}>
            {signup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Sign up
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-2">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
