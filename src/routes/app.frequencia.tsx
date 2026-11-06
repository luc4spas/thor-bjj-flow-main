import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PaginationBar, usePagination } from "@/components/pagination-bar";
import { CalendarCheck, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/frequencia")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin", "instructor"]}>
      <Frequencia />
    </ProtectedRoute>
  ),
});

function Frequencia() {
  const qc = useQueryClient();
  const [alunoId, setAlunoId] = useState<string>("");
  const [obs, setObs] = useState("");
  const [filtroAluno, setFiltroAluno] = useState<string>("todos");
  const [dataDe, setDataDe] = useState<string>(
    new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const [dataAte, setDataAte] = useState<string>(new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: alunos } = useQuery({
    queryKey: ["alunos-simple"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("id,nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: checkins, isLoading } = useQuery({
    queryKey: ["checkins", dataDe, dataAte, filtroAluno],
    queryFn: async () => {
      let q = supabase
        .from("checkins")
        .select("id, data_hora, origem, observacao, id_aluno, aluno:alunos(nome)")
        .gte("data_hora", `${dataDe}T00:00:00`)
        .lte("data_hora", `${dataAte}T23:59:59`)
        .order("data_hora", { ascending: false });
      if (filtroAluno !== "todos") q = q.eq("id_aluno", filtroAluno);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalPeriodo = checkins?.length ?? 0;
  const totalHoje = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return (checkins ?? []).filter((c) => c.data_hora.slice(0, 10) === hoje).length;
  }, [checkins]);

  async function registrar() {
    if (!alunoId) return toast.error("Selecione um aluno");
    const { error } = await supabase.from("checkins").insert({
      id_aluno: alunoId,
      origem: "manual",
      observacao: obs || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Check-in registrado");
    setObs("");
    qc.invalidateQueries({ queryKey: ["checkins"] });
  }

  async function remover(id: string) {
    const { error } = await supabase.from("checkins").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Check-in removido");
    qc.invalidateQueries({ queryKey: ["checkins"] });
  }

  const pag = usePagination(checkins ?? [], page, pageSize);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">Frequência</h1>
        <p className="text-sm text-muted-foreground">
          Check-ins manuais e registros vindos da catraca
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <StatCard label="Hoje" value={totalHoje} />
        <StatCard label="No período" value={totalPeriodo} />
        <StatCard label="Alunos ativos" value={alunos?.length ?? 0} />
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Registrar check-in manual</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Aluno</Label>
            <Select value={alunoId} onValueChange={setAlunoId}>
              <SelectTrigger><SelectValue placeholder="Selecione um aluno" /></SelectTrigger>
              <SelectContent>
                {alunos?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea rows={1} value={obs} onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: aula extra, treino privado…" />
          </div>
          <Button onClick={registrar}>Registrar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">De</Label>
          <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">Filtrar por aluno</Label>
          <Select value={filtroAluno} onValueChange={setFiltroAluno}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os alunos</SelectItem>
              {alunos?.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Data / Hora</th>
              <th className="px-4 py-3">Aluno</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Observação</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && pag.pageItems.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum check-in no período.</td></tr>
            )}
            {pag.pageItems.map((c) => {
              const d = new Date(c.data_hora);
              const aluno = c.aluno as { nome?: string } | null;
              return (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {d.toLocaleDateString("pt-BR")}{" "}
                    <span className="text-muted-foreground">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{aluno?.nome ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      c.origem === "catraca" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    ].join(" ")}>
                      {c.origem}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.observacao ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => remover(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
