import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, Trophy, Users, Wallet } from "lucide-react";
import logo from "@/assets/thor-logo.jpg";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("thor-recovery") === "1") return;
    if (user) navigate({ to: "/app/dashboard" });
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (res.error) toast.error(res.error);
  }

  const benefits = [
    { icon: Users, text: "Gestão completa de alunos e responsáveis" },
    { icon: Wallet, text: "Controle financeiro com recorrência automática" },
    { icon: Trophy, text: "Acompanhamento de faixas e graduações" },
    { icon: ShieldCheck, text: "Controle de acesso por perfil (ACL)" },
  ];

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 thor-gradient">
      {/* HERO */}
      <section className="relative flex flex-col justify-between p-6 sm:p-10 lg:p-16">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Thor BJJ" className="h-12 w-12 rounded-full ring-2 ring-primary/40" />
          <span className="text-lg font-bold tracking-wide">THOR BJJ <span className="text-primary">ERP</span></span>
        </div>

        <div className="mt-10 max-w-xl">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl lg:text-6xl">
            Thor BJJ:<br />
            <span className="text-primary">Forjando Campeões</span><br />
            desde 2003
          </h1>
          <p className="mt-6 max-w-md text-base text-muted-foreground">
            O sistema oficial de gestão da Thor BJJ — Cabo Frio/RJ. Tudo o que sua academia precisa em um só lugar.
          </p>

          <ul className="mt-8 space-y-3">
            {benefits.map((b) => (
              <li key={b.text} className="flex items-center gap-3 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <b.icon className="h-4 w-4" />
                </span>
                {b.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Thor BJJ · Cabo Frio — RJ
        </p>
      </section>

      {/* FORM */}
      <section className="flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <div className="w-full max-w-md rounded-2xl border bg-card/60 p-6 sm:p-8 shadow-2xl backdrop-blur">
          <h2 className="text-2xl font-bold">Entrar no sistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse com suas credenciais para continuar
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPwd ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Aguarde…" : "Entrar"}
            </Button>

            <button
              type="button"
              onClick={async () => {
                if (!email) return toast.error("Informe seu e-mail acima primeiro");
                const { error } = await (await import("@/integrations/supabase/client")).supabase.auth
                  .resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
                if (error) toast.error(error.message);
                else toast.success("Enviamos um link de recuperação para o seu e-mail.");
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-primary underline"
            >
              Esqueci minha senha
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Novos usuários são criados pelo administrador dentro do sistema.
          </p>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Thor BJJ ERP v1.0
          </p>
        </div>
      </section>
    </div>
  );
}
