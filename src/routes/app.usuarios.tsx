import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, ShieldCheck, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PaginationBar, usePagination } from "@/components/pagination-bar";
import { Search } from "lucide-react";

export const Route = createFileRoute("/app/usuarios")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin"]}>
      <UsuariosPage />
    </ProtectedRoute>
  ),
});

interface Perfil {
  id: string;
  nome: string | null;
  email: string | null;
  role: AppRole;
  created_at: string;
}

function UsuariosPage() {
  const { role: myRole, user: me } = useAuth();
  const qc = useQueryClient();

  const { data: perfis, isLoading } = useQuery({
    queryKey: ["perfis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis")
        .select("id,nome,email,role,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: AppRole }) => {
      const { error } = await supabase.from("perfis").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["perfis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [delPerfil, setDelPerfil] = useState<Perfil | null>(null);
  const [busyDel, setBusyDel] = useState(false);
  const [busca, setBusca] = useState("");
  const [roleF, setRoleF] = useState<"todos" | AppRole>("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = (perfis ?? []).filter((p) => {
    if (roleF !== "todos" && p.role !== roleF) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (!`${p.nome ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const pag = usePagination(filtered, page, pageSize);

  async function confirmDelete() {
    if (!delPerfil) return;
    setBusyDel(true);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { id: delPerfil.id },
    });
    setBusyDel(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Falha ao excluir");
      return;
    }
    toast.success("Usuário excluído");
    qc.invalidateQueries({ queryKey: ["perfis"] });
    setDelPerfil(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground">
            Crie novos usuários e defina seus níveis de acesso
          </p>
        </div>
        <NewUserDialog />
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome ou e-mail…"
            value={busca} onChange={(e) => { setBusca(e.target.value); setPage(1); }} />
        </div>
        <Select value={roleF} onValueChange={(v) => { setRoleF(v as typeof roleF); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="instructor">Instrutor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && pag.pageItems.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</TableCell></TableRow>
            )}
            {!isLoading && pag.pageItems.map((p) => {
              const isSelf = p.id === me?.id;
              const canEdit =
                !isSelf &&
                (myRole === "owner" || (myRole === "admin" && p.role !== "owner"));
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={p.role} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit ? (
                        <Select
                          defaultValue={p.role}
                          onValueChange={(v) => updateRole.mutate({ id: p.id, role: v as AppRole })}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {myRole === "owner" && <SelectItem value="owner">Owner</SelectItem>}
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="instructor">Instrutor</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">{isSelf ? "Você" : "—"}</span>
                      )}
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDelPerfil(p)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <PaginationBar
          page={pag.page} totalPages={pag.totalPages} total={pag.total}
          from={pag.from} to={pag.to} pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      <ConfirmDialog
        open={!!delPerfil}
        onOpenChange={(v) => { if (!v && !busyDel) setDelPerfil(null); }}
        title="Excluir usuário"
        description={`Excluir "${delPerfil?.nome ?? delPerfil?.email}"? Essa ação remove o acesso ao sistema.`}
        confirmLabel={busyDel ? "Excluindo…" : "Excluir"}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function RoleBadge({ role }: { role: AppRole }) {
  const map: Record<AppRole, { label: string; cls: string }> = {
    owner: { label: "Owner", cls: "bg-primary/15 text-primary border-primary/30" },
    admin: { label: "Admin", cls: "bg-warning/15 text-warning border-warning/30" },
    instructor: { label: "Instrutor", cls: "bg-muted text-muted-foreground border-border" },
  };
  const { label, cls } = map[role];
  return <Badge variant="outline" className={cls}>{label}</Badge>;
}

function NewUserDialog() {
  const { role: myRole } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("instructor");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { nome, email, password, role },
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Falha ao criar usuário");
      return;
    }
    toast.success("Usuário criado com sucesso");
    qc.invalidateQueries({ queryKey: ["perfis"] });
    setOpen(false);
    setNome(""); setEmail(""); setPassword(""); setRole("instructor");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><UserPlus className="mr-2 h-4 w-4" /> Novo Usuário</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar novo usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha provisória</Label>
            <Input id="password" type="text" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Perfil</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {myRole === "owner" && <SelectItem value="owner">Owner</SelectItem>}
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="instructor">Instrutor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Criar usuário"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
