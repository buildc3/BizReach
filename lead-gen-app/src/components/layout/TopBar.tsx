import { Menu } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface TopBarProps {
  title: string;
  action?: ReactNode;
}

export function TopBar({ title, action }: TopBarProps) {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card">
      <Button variant="ghost" size="icon" onClick={toggleSidebar}>
        <Menu className="h-4 w-4" />
      </Button>
      <h1 className="text-lg font-semibold text-foreground flex-1">{title}</h1>
      {action}
    </header>
  );
}
