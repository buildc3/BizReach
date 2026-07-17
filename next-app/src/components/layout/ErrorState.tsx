import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  message?: string;
  className?: string;
}

export function ErrorState({ message = "Something went wrong.", className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-12 text-destructive", className)}>
      <AlertCircle className="h-8 w-8 opacity-70" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
