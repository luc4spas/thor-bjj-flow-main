import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ArrowRightLeft, Camera } from "lucide-react";
import { useState } from "react";
import { fmtDate } from "@/lib/format";
import { AlunoFormDialog, type AlunoEditPayload } from "@/components/aluno-form-dialog";
import { CatracaFacialDialog } from "@/components/catraca-facial-dialog";
import { TrocarPlanoDialog } from "@/components/trocar-plano-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { PaginationBar, usePagination } from "@/components/pagination-bar";

export const Route = createFileRoute("/app/alunos")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin", "instructor"]}>
      <Alunos />
    </ProtectedRoute>
  ),
});

interface AlunoRow extends AlunoEditPayload {
  status_pagamento: "ok" | "atrasado" | "neutro";
  dependentes: string[];
  titularNome: string | null;
}

function Alunos() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canManage = role === "owner" || role === "admin";

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<AlunoEditPayload | null>(null);
  const [deleting, setDeleting] = useState<AlunoRow | null>(null);
  const [trocarPlano, setTrocarPlano] = useState<AlunoRow | null>(null);
  const [facialAluno, setFacialAluno] = useState<AlunoRow | null>(null);
  const [filter, setFilter] = useState("");
  const [faixaF, setFaixaF] = useState<string>("todas");
  const [statusF, setStatusF] = useState<"todos" | "ok" | "atrasado" | "neutro">("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: alunos, isLoading } = useQuery({
    queryKey: ["alunos-list"],
    queryFn: async (): Promise<AlunoRow[]> => {
      const { data: alunosData, error } = await supabase
        .from("alunos")
        .select("id,nome,faixa,graus,data_nascimento,telefone,email,cpf,id_responsavel,observacoes,endereco_rua,endereco_numero,endereco_bairro,endereco_cidade,endereco_cep,endereco_uf,titular_id")
        .order("nome");
      if (error) throw error;

      const { data: transData } = await supabase
        .from("transacoes")
        .select("id_aluno,status,data_vencimento,tipo");

      // mapa de titular -> lista de dependentes
      const depMap = new Map<string, string[]>();
      const nomeById = new Map<string, string>();
      (alunosData ?? []).forEach((a) => nomeById.set(a.id, a.nome));
      (alunosData ?? []).forEach((a) => {
        if (a.titular_id) {
          const arr = depMap.get(a.titular_id) ?? [];
          arr.push(a.nome);
          depMap.set(a.titular_id, arr);
        }
      });

      const today = new Date().toISOString().slice(0, 10);
      return (alunosData ?? []).map((a) => {
        const ts = (transData ?? []).filter((t) => t.id_aluno === a.id && t.tipo === "receita");
        let status: AlunoRow["status_pagamento"] = "neutro";
        if (transData) {
          const atrasado = ts.some((t) => t.status === "pendente" && t.data_vencimento < today);
          status = atrasado ? "atrasado" : "ok";
        }
        const dependentes = depMap.get(a.id) ?? [];
        const titularNome = a.titular_id ? nomeById.get(a.titular_id) ?? null : null;
        return { ...a, status_pagamento: status, dependentes, titularNome };
      });
    },
  });

  const filtered = (alunos ?? []).filter((a) => {
    if (filter && !a.nome.toLowerCase().includes(filter.toLowerCase())) return false;
    if (faixaF !== "todas" && a.faixa !== faixaF) return false;
    if (statusF !== "todos" && a.status_pagamento !== statusF) return false;
    return true;
  });
  const faixasDisponiveis = Array.from(new Set((alunos ?? []).map((a) => a.faixa))).sort();
  const pag = usePagination(filtered, page, pageSize);

  async function handleDelete() {
    if (!deleting) return;
    // Limpar dependências (não há FK cascade)
    await supabase.from("transacoes").delete().eq("id_aluno", deleting.id);
    await supabase.from("contratos").delete().eq("id_aluno", deleting.id);
    const { error } = await supabase.from("alunos").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Aluno removido");
      qc.invalidateQueries({ queryKey: ["alunos-list"] });
      qc.invalidateQueries({ queryKey: ["transacoes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
    }
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Alunos</h1>
          <p className="text-sm text-muted-foreground">Cadastro e acompanhamento dos atletas</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Aluno
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome…"
            value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} />
        </div>
        <Select value={faixaF} onValueChange={(v) => { setFaixaF(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Faixa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as faixas</SelectItem>
            {faixasDisponiveis.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusF} onValueChange={(v) => { setStatusF(v as typeof statusF); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ok">Em dia</SelectItem>
            <SelectItem value="atrasado">Atrasados</SelectItem>
            <SelectItem value="neutro">Sem dados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Faixa</th>
              <th className="px-4 py-3">Graus</th>
              <th className="px-4 py-3">Nascimento</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && pag.pageItems.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum aluno encontrado.</td></tr>
            )}
            {pag.pageItems.map((a) => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3"><StatusDot status={a.status_pagamento} /></td>
                <td className="px-4 py-3 font-medium">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{a.nome}</span>
                    {a.dependentes.length > 0 && (
                      <span
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                        title={`Dependentes: ${a.dependentes.join(", ")}`}
                      >
                        Titular · {a.dependentes.length}
                      </span>
                    )}
                    {a.titularNome && (
                      <span
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                        title={`Titular: ${a.titularNome}`}
                      >
                        Dep. de {a.titularNome}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{a.faixa}</td>
                <td className="px-4 py-3">{a.graus}</td>
                <td className="px-4 py-3">{fmtDate(a.data_nascimento)}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.telefone ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(a); setOpenForm(true); }}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFacialAluno(a)}>
                          <Camera className="mr-2 h-4 w-4" /> Cadastrar Facial
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTrocarPlano(a)}>
                          <ArrowRightLeft className="mr-2 h-4 w-4" /> Trocar Plano
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(a)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <PaginationBar
          page={pag.page} totalPages={pag.totalPages} total={pag.total}
          from={pag.from} to={pag.to} pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      <AlunoFormDialog
        open={openForm}
        onOpenChange={(v) => { setOpenForm(v); if (!v) setEditing(null); }}
        aluno={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["alunos-list"] })}
      />
      <TrocarPlanoDialog
        open={!!trocarPlano}
        onOpenChange={(v) => { if (!v) setTrocarPlano(null); }}
        alunoId={trocarPlano?.id ?? null}
        alunoNome={trocarPlano?.nome}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["alunos-list"] });
          qc.invalidateQueries({ queryKey: ["transacoes"] });
          qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => { if (!v) setDeleting(null); }}
        title="Excluir aluno"
        description={`Excluir "${deleting?.nome}" removerá também contratos e parcelas vinculadas. Confirmar?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
      <CatracaFacialDialog
        open={!!facialAluno}
        onOpenChange={(v) => { if (!v) setFacialAluno(null); }}
        alunoId={facialAluno?.id ?? ""}
        alunoNome={facialAluno?.nome ?? ""}
        alunoCpf={facialAluno?.cpf ?? ""}
        alunoMatricula={facialAluno?.matricula ?? ""}
      />
    </div>
  );
}

function StatusDot({ status }: { status: AlunoRow["status_pagamento"] }) {
  const map = {
    ok: { color: "bg-success", title: "Em dia" },
    atrasado: { color: "bg-primary", title: "Possui parcela atrasada" },
    neutro: { color: "bg-muted-foreground/40", title: "Sem dados" },
  } as const;
  const m = map[status];
  return <span className={["inline-block h-3 w-3 rounded-full shadow", m.color].join(" ")} title={m.title} />;
}
