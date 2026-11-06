import { createFileRoute, Outlet, Navigate, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { LayoutDashboard, Users, Wallet, BarChart3, Settings, LogOut, ShieldCheck, CalendarCheck, Menu } from "lucide-react";
import logo from "@/assets/thor-logo.jpg";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

const NAV: NavItem[] = [
  { to: "/app/dashboard", label: "Início", icon: LayoutDashboard, roles: ["owner", "admin"] },
  { to: "/app/alunos", label: "Alunos", icon: Users, roles: ["owner", "admin", "instructor"] },
  { to: "/app/frequencia", label: "Frequência", icon: CalendarCheck, roles: ["owner", "admin", "instructor"] },
  { to: "/app/catraca", label: "Catraca", icon: ShieldCheck, roles: ["owner", "admin", "instructor"] },
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet, roles: ["owner", "admin"] },
  { to: "/app/relatorios", label: "Relatórios", icon: BarChart3, roles: ["owner", "admin"] },
  { to: "/app/usuarios", label: "Usuários", icon: Users, roles: ["owner", "admin"] },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings, roles: ["owner", "admin"] },
];

function AppLayout() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Carregando…</div>;
  if (!user) return <Navigate to="/login" />;

  const items = NAV.filter((n) => role && n.roles.includes(role));

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <div className="flex items-center gap-3 px-2 py-3">
          <img src={logo} alt="Thor BJJ" className="h-10 w-10 rounded-full ring-2 ring-primary/40" />
          <div>
            <p className="text-sm font-bold leading-tight">THOR BJJ</p>
            <p className="text-xs text-muted-foreground">Cabo Frio · RJ</p>
          </div>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3">
          <p className="truncate text-xs font-medium">{user.email}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{role}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start text-xs"
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
          >
            <LogOut className="mr-2 h-3 w-3" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        {/* Mobile bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-3 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[80vw] max-w-xs bg-sidebar p-4">
                <div className="flex items-center gap-3 py-2">
                  <img src={logo} alt="Thor BJJ" className="h-9 w-9 rounded-full ring-2 ring-primary/40" />
                  <div>
                    <p className="text-sm font-bold leading-tight">THOR BJJ</p>
                    <p className="text-xs text-muted-foreground">Cabo Frio · RJ</p>
                  </div>
                </div>
                <nav className="mt-4 flex flex-col gap-1">
                  {items.map((item) => {
                    const active = pathname.startsWith(item.to);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMenuOpen(false)}
                        className={[
                          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                          active ? "bg-primary/15 font-medium text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="mt-6 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3">
                  <p className="truncate text-xs font-medium">{user.email}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{role}</p>
                </div>
              </SheetContent>
            </Sheet>
            <img src={logo} alt="Thor BJJ" className="h-8 w-8 rounded-full" />
            <span className="text-sm font-bold">THOR BJJ ERP</span>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
