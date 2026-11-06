import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/app/")({
  component: () => {
    const { role } = useAuth();
    if (role === "instructor") return <Navigate to="/app/alunos" />;
    return <Navigate to="/app/dashboard" />;
  },
});
