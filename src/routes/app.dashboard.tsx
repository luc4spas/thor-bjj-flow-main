import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtBRL } from "@/lib/format";
import { TrendingUp, AlertTriangle, Receipt, Users, UserCheck, UserX, UserPlus, FileSignature, Cake } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin"]}>
      <Dashboard />
    </ProtectedRoute>
  ),
});

function Dashboard() {
  const { data: trans, isLoading: lT } = useQuery({
    queryKey: ["dash-trans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacoes")
        .select("tipo,valor,data_vencimento,data_pagamento,status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: alunos, isLoading: lA } = useQuery({
    queryKey: ["dash-alunos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id,nome,faixa,graus,data_nascimento,created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contratos, isLoading: lC } = useQuery({
    queryKey: ["dash-contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id,id_aluno,status,data_inicio,data_fim");
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const tList = trans ?? [];
  const aList = alunos ?? [];
  const cList = contratos ?? [];

  // Financeiro
  const receitaPrevista = tList
    .filter((t) => t.tipo === "receita" && new Date(t.data_vencimento) >= startMonth && new Date(t.data_vencimento) <= endMonth)
    .reduce((s, t) => s + Number(t.valor), 0);
  const receitaRecebida = tList
    .filter((t) => t.tipo === "receita" && t.status === "pago" && t.data_pagamento && new Date(t.data_pagamento) >= startMonth && new Date(t.data_pagamento) <= endMonth)
    .reduce((s, t) => s + Number(t.valor), 0);
  const inadimplencia = tList
    .filter((t) => t.tipo === "receita" && t.status === "pendente" && new Date(t.data_vencimento) < today)
    .reduce((s, t) => s + Number(t.valor), 0);
  const contasPagar = tList
    .filter((t) => t.tipo === "despesa" && t.status === "pendente")
    .reduce((s, t) => s + Number(t.valor), 0);

  // Alunos
  const alunosAtivosIds = new Set(
    cList.filter((c) => c.status === "ativo").map((c) => c.id_aluno),
  );
  const totalAlunos = aList.length;
  const ativos = aList.filter((a) => alunosAtivosIds.has(a.id)).length;
  const inativos = totalAlunos - ativos;
  const novosMes = aList.filter((a) => {
    const d = new Date(a.created_at);
    return d >= startMonth && d <= endMonth;
  }).length;
  const contratosAtivos = cList.filter((c) => c.status === "ativo").length;

  // Aniversariantes do mês
  const aniversariantes = aList.filter((a) => {
    if (!a.data_nascimento) return false;
    const d = new Date(a.data_nascimento);
    return d.getMonth() === today.getMonth();
  });

  // Distribuição por faixa
  const faixaMap: Record<string, number> = {};
  aList.forEach((a) => {
    const f = a.faixa || "Branca";
    faixaMap[f] = (faixaMap[f] ?? 0) + 1;
  });
  const faixaCores: Record<string, string> = {
    Branca: "oklch(0.95 0 0)",
    Cinza: "oklch(0.65 0 0)",
    Amarela: "oklch(0.85 0.18 95)",
    Laranja: "oklch(0.72 0.19 55)",
    Verde: "oklch(0.65 0.16 145)",
    Azul: "oklch(0.6 0.18 250)",
    Roxa: "oklch(0.5 0.2 305)",
    Marrom: "oklch(0.45 0.08 50)",
    Preta: "oklch(0.25 0 0)",
  };
  const faixaData = Object.entries(faixaMap).map(([faixa, qtd]) => ({
    faixa, qtd, fill: faixaCores[faixa] ?? "oklch(0.6 0 0)",
  }));

  // Fluxo 6 meses
  const chart = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - idx), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const inMonth = tList.filter((t) => {
      const dt = new Date(t.data_vencimento);
      return dt >= d && dt <= end;
    });
    return {
      mes: d.toLocaleDateString("pt-BR", { month: "short" }),
      receita: inMonth.filter((t) => t.tipo === "receita").reduce((s, t) => s + Number(t.valor), 0),
      despesa: inMonth.filter((t) => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor), 0),
    };
  });

  const isLoading = lT || lA || lC;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">Dashboard Geral</h1>
        <p className="text-sm text-muted-foreground">Visão geral da academia</p>
      </header>

      {/* Alunos */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Alunos</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard title="Total de Alunos" value={String(totalAlunos)} icon={<Users className="h-5 w-5" />} tone="info" />
          <KpiCard title="Alunos Ativos" value={String(ativos)} icon={<UserCheck className="h-5 w-5" />} tone="success" />
          <KpiCard title="Alunos Inativos" value={String(inativos)} icon={<UserX className="h-5 w-5" />} tone="danger" />
          <KpiCard title="Novos no Mês" value={String(novosMes)} icon={<UserPlus className="h-5 w-5" />} tone="info" />
        </div>
      </section>

      {/* Financeiro */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Financeiro</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard title="Receita Prevista (mês)" value={fmtBRL(receitaPrevista)} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
          <KpiCard title="Recebido no Mês" value={fmtBRL(receitaRecebida)} icon={<Receipt className="h-5 w-5" />} tone="info" />
          <KpiCard title="Inadimplência" value={fmtBRL(inadimplencia)} icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
          <KpiCard title="Contas a Pagar" value={fmtBRL(contasPagar)} icon={<Receipt className="h-5 w-5" />} tone="warning" />
        </div>
      </section>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Fluxo de Caixa — últimos 6 meses</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="r" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.65 0.16 145)" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="oklch(0.65 0.16 145)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="d" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.55 0.22 27)" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="oklch(0.55 0.22 27)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="oklch(0.22 0 0)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="oklch(0.65 0 0)" fontSize={12} />
                    <YAxis stroke="oklch(0.65 0 0)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip contentStyle={{ background: "oklch(0.11 0 0)", border: "1px solid oklch(0.22 0 0)", borderRadius: 8 }} formatter={(v: number) => fmtBRL(v)} />
                    <Area type="monotone" dataKey="receita" name="Receita" stroke="oklch(0.65 0.16 145)" fill="url(#r)" />
                    <Area type="monotone" dataKey="despesa" name="Despesa" stroke="oklch(0.55 0.22 27)" fill="url(#d)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Distribuição por Faixa</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : faixaData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum aluno cadastrado.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faixaData} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid stroke="oklch(0.22 0 0)" strokeDasharray="3 3" />
                    <XAxis type="number" stroke="oklch(0.65 0 0)" fontSize={12} allowDecimals={false} />
                    <YAxis type="category" dataKey="faixa" stroke="oklch(0.65 0 0)" fontSize={12} width={70} />
                    <Tooltip contentStyle={{ background: "oklch(0.11 0 0)", border: "1px solid oklch(0.22 0 0)", borderRadius: 8 }} />
                    <Bar dataKey="qtd" name="Alunos" radius={[0, 4, 4, 0]}>
                      {faixaData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" /> Contratos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{contratosAtivos}</p>
            <p className="text-sm text-muted-foreground mt-1">contratos vigentes na academia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-4 w-4" /> Aniversariantes do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aniversariantes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aniversariante neste mês.</p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {aniversariantes.map((a) => {
                  const d = new Date(a.data_nascimento!);
                  return (
                    <li key={a.id} className="flex items-center justify-between text-sm">
                      <span>{a.nome}</span>
                      <span className="text-muted-foreground">
                        {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: "success" | "danger" | "warning" | "info" }) {
  const colors = {
    success: "text-success bg-success/10",
    danger: "text-primary bg-primary/15",
    warning: "text-warning bg-warning/10",
    info: "text-foreground bg-muted",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className={["flex h-12 w-12 items-center justify-center rounded-lg", colors[tone]].join(" ")}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
