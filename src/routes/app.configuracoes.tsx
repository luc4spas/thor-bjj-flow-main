import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import { Plus, Trash, Pencil, Check, X, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PaginationBar, usePagination } from "@/components/pagination-bar";

export const Route = createFileRoute("/app/configuracoes")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin"]}>
      <Config />
    </ProtectedRoute>
  ),
});

interface Plano {
  id: string;
  nome: string;
  duracao_meses: number;
  valor_padrao: number;
}

function Config() {
  const qc = useQueryClient();

  const { data: planos } = useQuery({
    queryKey: ["cfg-planos"],
    queryFn: async () => ((await supabase.from("planos").select("*").order("duracao_meses")).data ?? []) as Plano[],
  });

  const [nome, setNome] = useState("");
  const [dur, setDur] = useState("1");
  const [valor, setValor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editDur, setEditDur] = useState("1");
  const [editValor, setEditValor] = useState("");
  const [delPlano, setDelPlano] = useState<Plano | null>(null);
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const planosFiltrados = (planos ?? []).filter((p) =>
    !busca || p.nome.toLowerCase().includes(busca.toLowerCase()),
  );
  const pag = usePagination(planosFiltrados, page, pageSize);

  async function addPlano() {
    if (!nome || !valor) return toast.error("Preencha nome e valor");
    const { error } = await supabase.from("planos").insert({
      nome, duracao_meses: Number(dur), valor_padrao: Number(valor),
    });
    if (error) toast.error(error.message);
    else { toast.success("Plano adicionado"); setNome(""); setValor(""); setDur("1"); qc.invalidateQueries({ queryKey: ["cfg-planos"] }); }
  }

  function startEdit(p: Plano) {
    setEditingId(p.id);
    setEditNome(p.nome);
    setEditDur(String(p.duracao_meses));
    setEditValor(String(p.valor_padrao));
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!editNome || !editValor) return toast.error("Preencha nome e valor");
    const { error } = await supabase.from("planos").update({
      nome: editNome, duracao_meses: Number(editDur), valor_padrao: Number(editValor),
    }).eq("id", editingId);
    if (error) toast.error(error.message);
    else { toast.success("Plano atualizado"); setEditingId(null); qc.invalidateQueries({ queryKey: ["cfg-planos"] }); }
  }

  async function confirmDelete() {
    if (!delPlano) return;
    const { error } = await supabase.from("planos").delete().eq("id", delPlano.id);
    if (error) toast.error(error.message);
    else { toast.success("Plano removido"); qc.invalidateQueries({ queryKey: ["cfg-planos"] }); }
    setDelPlano(null);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">Configurações</h1>
        <p className="text-sm text-muted-foreground">Planos da academia</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Planos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_160px_auto]">
            <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Bimestral" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Duração (meses)</Label><Input type="number" min={1} value={dur} onChange={(e) => setDur(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Valor Padrão</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
            <Button className="self-end" onClick={addPlano}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar plano…"
              value={busca} onChange={(e) => { setBusca(e.target.value); setPage(1); }} />
          </div>

          <div className="overflow-hidden rounded-md border">
            <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Duração</th><th className="px-3 py-2">Valor</th><th className="px-3 py-2 w-28"></th></tr>
              </thead>
              <tbody>
                {pag.pageItems.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nenhum plano encontrado.</td></tr>
                )}
                {pag.pageItems.map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">
                        {isEditing ? <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} /> : p.nome}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? <Input type="number" min={1} value={editDur} onChange={(e) => setEditDur(e.target.value)} className="w-20" /> : `${p.duracao_meses} m`}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? <Input type="number" step="0.01" value={editValor} onChange={(e) => setEditValor(e.target.value)} className="w-28" /> : fmtBRL(p.valor_padrao)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={saveEdit}><Check className="h-4 w-4 text-success" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setDelPlano(p)}><Trash className="h-4 w-4 text-primary" /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            <PaginationBar
              page={pag.page} totalPages={pag.totalPages} total={pag.total}
              from={pag.from} to={pag.to} pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              pageSizeOptions={[5, 10, 25, 50]}
            />
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usuários e Permissões</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A gestão de usuários foi movida para o módulo dedicado <strong>Usuários</strong> no menu lateral.
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!delPlano}
        onOpenChange={(v) => { if (!v) setDelPlano(null); }}
        title="Excluir plano"
        description={`Excluir o plano "${delPlano?.nome}"? Contratos existentes não serão afetados.`}
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
