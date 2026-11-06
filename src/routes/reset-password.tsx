import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/thor-logo.jpg";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [{ title: "Redefinir Senha · Thor BJJ" }],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // O link do email chega com #access_token&type=recovery — o cliente Supabase
    // processa automaticamente e emite PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("A senha deve ter ao menos 6 caracteres");
    if (password !== confirm) return toast.error("As senhas não conferem");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (typeof window !== "undefined") sessionStorage.removeItem("thor-recovery");
    toast.success("Senha atualizada. Faça login com a nova senha.");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="grid min-h-screen place-items-center thor-gradient p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card/60 p-6 sm:p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <img src={logo} alt="Thor BJJ" className="h-10 w-10 rounded-full ring-2 ring-primary/40" />
          <span className="font-bold tracking-wide">THOR BJJ <span className="text-primary">ERP</span></span>
        </div>
        <h2 className="text-2xl font-bold">Definir nova senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready ? "Escolha uma nova senha para sua conta." : "Validando link de recuperação…"}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Input id="password" type={show ? "text" : "password"} required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={!ready} />
              <button type="button" onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input id="confirm" type={show ? "text" : "password"} required minLength={6}
              value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" disabled={!ready} />
          </div>

          <Button type="submit" className="w-full" disabled={busy || !ready}>
            {busy ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <button onClick={() => navigate({ to: "/login" })} className="hover:text-foreground underline">
            Voltar para o login
          </button>
        </p>
      </div>
    </div>
  );
}
