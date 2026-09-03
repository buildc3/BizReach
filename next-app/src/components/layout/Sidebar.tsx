"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, LogOut, Mail, Package, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { useFollowups } from "@/hooks/useMessages";
import { useMe, useLogout } from "@/hooks/useAuth";

const NAV = [
  { to: "/", icon: Search, label: "Searches" },
  { to: "/leads", icon: BarChart3, label: "Leads" },
  { to: "/templates", icon: FileText, label: "Templates" },
  { to: "/messages", icon: Mail, label: "Messages" },
  { to: "/products", icon: Package, label: "Products" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const { sidebarCollapsed } = useUIStore();
  const { data: followups } = useFollowups();
  const { data: me } = useMe();
  const logout = useLogout();
  const currentPath = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-card border-r border-border transition-all duration-200",
        sidebarCollapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2 px-4 py-5 border-b border-border", sidebarCollapsed && "justify-center px-0")}>
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Search className="h-4 w-4 text-primary-foreground" />
        </div>
        {!sidebarCollapsed && <span className="font-semibold text-sm">LeadGen</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {NAV.map(({ to, icon: Icon, label }) => {
          const isActive = to === "/" ? currentPath === "/" : currentPath.startsWith(to);
          const badge = label === "Messages" && (followups?.length ?? 0) > 0 ? followups!.length : null;

          return (
            <Link
              key={to}
              href={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                sidebarCollapsed && "justify-center px-0"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="flex-1">{label}</span>
              )}
              {!sidebarCollapsed && badge && (
                <span className="text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Current user + logout */}
      <div className={cn("border-t border-border p-2", sidebarCollapsed && "flex justify-center")}>
        {!sidebarCollapsed && me && (
          <p className="px-1 pb-1 text-xs text-muted-foreground truncate">{me.email}</p>
        )}
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!sidebarCollapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}
