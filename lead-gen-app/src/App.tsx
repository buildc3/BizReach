import { createRouter, RouterProvider, createRoute, createRootRoute, Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardPage } from "@/pages/Dashboard";
import { SearchesPage } from "@/pages/Searches";
import { LeadsPage } from "@/pages/Leads";
import { PitchesPage } from "@/pages/Pitches";
import { MessagesPage } from "@/pages/Messages";
import { ProductsPage } from "@/pages/Products";
import { SettingsPage } from "@/pages/Settings";

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  ),
});

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: DashboardPage });
const searchesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/searches", component: SearchesPage });
const leadsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/leads", component: LeadsPage });
const pitchesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pitches", component: PitchesPage });
const messagesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/messages", component: MessagesPage });
const productsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/products", component: ProductsPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });

const routeTree = rootRoute.addChildren([
  indexRoute, searchesRoute, leadsRoute, pitchesRoute, messagesRoute, productsRoute, settingsRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

export default function App() {
  return <RouterProvider router={router} />;
}
