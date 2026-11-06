import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";
import { useEffect } from "react";

/** Se o link de recuperação de senha cair em qualquer rota, leva para /reset-password. */
function RecoveryRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const isRecovery =
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      new URLSearchParams(search).get("code") !== null && sessionStorage.getItem("thor-recovery") === "1";
    if (hash.includes("type=recovery") || search.includes("type=recovery")) {
      sessionStorage.setItem("thor-recovery", "1");
    }
    if (isRecovery && !window.location.pathname.startsWith("/reset-password")) {
      window.location.replace(`/reset-password${hash}${hash ? "" : search}`);
    }
  }, []);
  return null;
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >Tentar novamente</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Thor BJJ ERP" },
      { name: "description", content: "Sistema de gestão da Thor BJJ — alunos, contratos e financeiro." },
      { property: "og:title", content: "Thor BJJ ERP" },
      { name: "twitter:title", content: "Thor BJJ ERP" },
      { property: "og:description", content: "Sistema de gestão da Thor BJJ — alunos, contratos e financeiro." },
      { name: "twitter:description", content: "Sistema de gestão da Thor BJJ — alunos, contratos e financeiro." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aba82d17-4dbd-45fd-b94f-c09529406564/id-preview-2a2f4b08--f8e68b72-9f0a-4bbf-a0cc-144de0209386.lovable.app-1778256837091.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aba82d17-4dbd-45fd-b94f-c09529406564/id-preview-2a2f4b08--f8e68b72-9f0a-4bbf-a0cc-144de0209386.lovable.app-1778256837091.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head><HeadContent /></head>
      <body><div id="app">{children}</div><Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RecoveryRedirect />
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
