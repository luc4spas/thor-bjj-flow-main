import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, Plus, Pencil, Trash2, MoreHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PaginationBar, usePagination } from "@/components/pagination-bar";
import { Search, X } from "lucide-react";

export const Route = createFileRoute("/app/financeiro")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin"]}>
      <Financeiro />
    </ProtectedRoute>
  ),
});

type TipoTrans = "receita" | "despesa";
type FormaPagamento =
  | "dinheiro" | "pix" | "cartao_credito" | "cartao_debito"
  | "boleto" | "transferencia" | "outro";

const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

function formaLabel(v?: string | null) {
  if (!v) return "—";
  return FORMAS_PAGAMENTO.find((f) => f.value === v)?.label ?? v;
}

interface TransacaoRow {
  id: string;
  tipo: TipoTrans;
  categoria: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: "pendente" | "pago" | "cancelado";
  forma_pagamento: FormaPagamento | null;
  id_aluno: string | null;
  alunos: { nome: string } | null;
}

function Financeiro() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TipoTrans>("receita");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<TransacaoRow | null>(null);
  const [deleting, setDeleting] = useState<TransacaoRow | null>(null);
  const [paying, setPaying] = useState<TransacaoRow | null>(null);

  // filtros
  const [busca, setBusca] = useState("");
  const [statusF, setStatusF] = useState<"todos" | "pendente" | "pago" | "atrasado">("todos");
  const [formaF, setFormaF] = useState<"todas" | FormaPagamento>("todas");
  const [categoriaF, setCategoriaF] = useState<string>("todas");
  const [dtIni, setDtIni] = useState("");
  const [dtFim, setDtFim] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ["transacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacoes")
        .select("id,tipo,categoria,descricao,valor,data_vencimento,data_pagamento,status,forma_pagamento,id_aluno,alunos(nome)")
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TransacaoRow[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const filtered = (data ?? []).filter((t) => {
    if (t.tipo !== tab) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const hay = `${t.descricao ?? ""} ${t.categoria} ${t.alunos?.nome ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusF !== "todos") {
      const atrasado = t.status === "pendente" && t.data_vencimento < today;
      if (statusF === "atrasado" && !atrasado) return false;
      if (statusF === "pendente" && (t.status !== "pendente" || atrasado)) return false;
      if (statusF === "pago" && t.status !== "pago") return false;
    }
    if (formaF !== "todas" && t.forma_pagamento !== formaF) return false;
    if (categoriaF !== "todas" && t.categoria !== categoriaF) return false;
    if (dtIni && t.data_vencimento < dtIni) return false;
    if (dtFim && t.data_vencimento > dtFim) return false;
    return true;
  });

  const totais = filtered.reduce(
    (acc, t) => {
      acc.total += Number(t.valor);
      if (t.status === "pago") acc.pago += Number(t.valor);
      else acc.aberto += Number(t.valor);
      return acc;
    },
    { total: 0, pago: 0, aberto: 0 },
  );

  const pag = usePagination(filtered, page, pageSize);
  const list = pag.pageItems;

  const categoriasDisponiveis = Array.from(
    new Set((data ?? []).filter((t) => t.tipo === tab).map((t) => t.categoria)),
  ).sort();

  function limparFiltros() {
    setBusca(""); setStatusF("todos"); setFormaF("todas");
    setCategoriaF("todas"); setDtIni(""); setDtFim(""); setPage(1);
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["transacoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
    qc.invalidateQueries({ queryKey: ["alunos-list"] });
  }

  async function reabrir(id: string) {
    const { error } = await supabase.from("transacoes").update({
      status: "pendente", data_pagamento: null, forma_pagamento: null,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Lançamento reaberto"); invalidate(); }
  }

  async function handleDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("transacoes").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else { toast.success("Lançamento excluído"); invalidate(); }
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Contas a Receber e a Pagar</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Lançamento
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as TipoTrans); setPage(1); setCategoriaF("todas"); }}>
        <TabsList>
          <TabsTrigger value="receita">Contas a Receber</TabsTrigger>
          <TabsTrigger value="despesa">Contas a Pagar</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-4">
          {/* Filtros */}
          <div className="rounded-lg border bg-card p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar descrição, aluno…"
                  value={busca} onChange={(e) => { setBusca(e.target.value); setPage(1); }} />
              </div>
              <Select value={statusF} onValueChange={(v) => { setStatusF(v as typeof statusF); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoriaF} onValueChange={(v) => { setCategoriaF(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas categorias</SelectItem>
                  {categoriasDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={formaF} onValueChange={(v) => { setFormaF(v as typeof formaF); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas formas</SelectItem>
                  {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-end gap-1">
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="ml-auto">
                  <X className="mr-1 h-3 w-3" /> Limpar
                </Button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Vencimento de</Label>
                <Input type="date" value={dtIni} onChange={(e) => { setDtIni(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento até</Label>
                <Input type="date" value={dtFim} onChange={(e) => { setDtFim(e.target.value); setPage(1); }} />
              </div>
              <div className="md:col-span-2 grid grid-cols-3 gap-2 self-end rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <div><div className="text-muted-foreground">Total</div><div className="font-semibold">{fmtBRL(totais.total)}</div></div>
                <div><div className="text-muted-foreground">Pago</div><div className="font-semibold text-success">{fmtBRL(totais.pago)}</div></div>
                <div><div className="text-muted-foreground">Em aberto</div><div className="font-semibold text-warning">{fmtBRL(totais.aberto)}</div></div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">{tab === "receita" ? "Aluno" : "Categoria"}</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Forma</th>
                  <th className="px-4 py-3 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && list.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sem registros.</td></tr>}
                {list.map((t) => {
                  const atrasado = t.status === "pendente" && t.data_vencimento < today;
                  return (
                    <tr key={t.id} className={["border-t border-border hover:bg-muted/20", atrasado ? "bg-[var(--danger-row)]" : ""].join(" ")}>
                      <td className="px-4 py-3">{fmtDate(t.data_vencimento)}</td>
                      <td className="px-4 py-3">{tab === "receita" ? (t.alunos?.nome ?? "—") : t.categoria}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.descricao ?? "—"}</td>
                      <td className="px-4 py-3 font-medium">{fmtBRL(t.valor)}</td>
                      <td className="px-4 py-3">
                        <span className={[
                          "rounded-full px-2 py-0.5 text-xs",
                          t.status === "pago" ? "bg-success/15 text-success" : atrasado ? "bg-primary/20 text-primary" : "bg-warning/15 text-warning",
                        ].join(" ")}>
                          {t.status === "pago" ? "Pago" : atrasado ? "Atrasado" : "Pendente"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.data_pagamento)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formaLabel(t.forma_pagamento)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {t.status === "pendente" && (
                            <Button size="sm" variant="outline" onClick={() => setPaying(t)}>
                              <Check className="mr-1 h-3 w-3" /> Pagar
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditing(t); setOpenForm(true); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              {t.status === "pago" && (
                                <DropdownMenuItem onClick={() => reabrir(t.id)}>
                                  <RotateCcw className="mr-2 h-4 w-4" /> Reabrir
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(t)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
            />
          </div>
        </TabsContent>
      </Tabs>

      <TransacaoDialog
        open={openForm}
        onOpenChange={(v) => { setOpenForm(v); if (!v) setEditing(null); }}
        defaultTipo={tab}
        editing={editing}
        onSaved={invalidate}
      />
      <PagamentoDialog
        transacao={paying}
        onOpenChange={(v) => { if (!v) setPaying(null); }}
        onSaved={invalidate}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => { if (!v) setDeleting(null); }}
        title="Excluir lançamento"
        description="Esta ação removerá o lançamento financeiro permanentemente."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function PagamentoDialog({
  transacao, onOpenChange, onSaved,
}: {
  transacao: TransacaoRow | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (transacao) {
      setForma((transacao.forma_pagamento as FormaPagamento) ?? "pix");
      setData(new Date().toISOString().slice(0, 10));
    }
  }, [transacao]);

  async function confirmar() {
    if (!transacao) return;
    setBusy(true);
    const { error } = await supabase.from("transacoes").update({
      status: "pago", data_pagamento: data, forma_pagamento: forma,
    }).eq("id", transacao.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pagamento registrado!");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={!!transacao} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        {transacao && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Descrição</span><span>{transacao.descricao ?? transacao.categoria}</span></div>
              <div className="flex justify-between font-medium"><span className="text-muted-foreground">Valor</span><span>{fmtBRL(transacao.valor)}</span></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data do Pagamento</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={busy}>{busy ? "Salvando…" : "Confirmar Pagamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CATEGORIAS_DESPESA = ["Aluguel", "Salário", "Material", "Marketing", "Utilidades", "Outros"];
const CATEGORIAS_RECEITA = ["Mensalidade", "Matrícula", "Avulso", "Outros"];

function TransacaoDialog({
  open, onOpenChange, defaultTipo, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTipo: TipoTrans;
  editing: TransacaoRow | null;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [tipo, setTipo] = useState<TipoTrans>(defaultTipo);
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [venc, setVenc] = useState(new Date().toISOString().slice(0, 10));
  const [idAluno, setIdAluno] = useState<string>("");
  const [status, setStatus] = useState<"pendente" | "pago">("pendente");
  const [dataPagto, setDataPagto] = useState<string>("");
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const [busy, setBusy] = useState(false);

  const { data: alunos } = useQuery({
    queryKey: ["alunos-min"],
    queryFn: async () => (await supabase.from("alunos").select("id,nome").order("nome")).data ?? [],
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo(editing.tipo);
      setCategoria(editing.categoria);
      setDescricao(editing.descricao ?? "");
      setValor(String(editing.valor));
      setVenc(editing.data_vencimento);
      setIdAluno(editing.id_aluno ?? "");
      setStatus(editing.status === "pago" ? "pago" : "pendente");
      setDataPagto(editing.data_pagamento ?? "");
      setForma((editing.forma_pagamento as FormaPagamento) ?? "");
    } else {
      setTipo(defaultTipo);
      setCategoria(defaultTipo === "receita" ? "Avulso" : "Aluguel");
      setDescricao(""); setValor("");
      setVenc(new Date().toISOString().slice(0, 10));
      setIdAluno(""); setStatus("pendente"); setDataPagto(""); setForma("");
    }
  }, [open, editing, defaultTipo]);

  const categorias = tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  async function salvar() {
    if (!valor) return toast.error("Informe o valor");
    if (!categoria) return toast.error("Informe a categoria");
    if (status === "pago" && !forma) return toast.error("Informe a forma de pagamento");
    setBusy(true);
    const payload = {
      tipo, categoria, descricao: descricao || null,
      valor: Number(valor), data_vencimento: venc,
      id_aluno: tipo === "receita" && idAluno ? idAluno : null,
      status,
      data_pagamento: status === "pago" ? (dataPagto || new Date().toISOString().slice(0, 10)) : null,
      forma_pagamento: status === "pago" && forma ? (forma as FormaPagamento) : null,
    };
    const { error } = isEdit
      ? await supabase.from("transacoes").update(payload).eq("id", editing!.id)
      : await supabase.from("transacoes").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Lançamento atualizado" : "Lançamento criado");
    onSaved(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoTrans); setCategoria(v === "receita" ? "Avulso" : "Aluguel"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {tipo === "receita" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Aluno (opcional)</Label>
              <Select value={idAluno || "none"} onValueChange={(v) => setIdAluno(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar aluno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem vínculo —</SelectItem>
                  {(alunos ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label className="text-xs">Valor</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Vencimento</Label><Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "pendente" | "pago")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {status === "pago" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Data Pagamento</Label>
                <Input type="date" value={dataPagto} onChange={(e) => setDataPagto(e.target.value)} />
              </div>
            )}
          </div>

          {status === "pago" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
                <SelectTrigger><SelectValue placeholder="Selecionar forma" /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
