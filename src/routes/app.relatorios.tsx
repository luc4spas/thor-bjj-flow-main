import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { fmtBRL } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/app/relatorios")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin"]}>
      <Relatorios />
    </ProtectedRoute>
  ),
});

function Relatorios() {
  const { data: trans } = useQuery({
    queryKey: ["rel-trans"],
    queryFn: async () => {
      const { data } = await supabase.from("transacoes").select("tipo,valor,status,data_vencimento");
      return data ?? [];
    },
  });
  const { data: alunos } = useQuery({
    queryKey: ["rel-alunos"],
    queryFn: async () => (await supabase.from("alunos").select("faixa")).data ?? [],
  });

  const totalRecebido = (trans ?? []).filter((t) => t.tipo === "receita" && t.status === "pago").reduce((s, t) => s + Number(t.valor), 0);
  const totalDespesas = (trans ?? []).filter((t) => t.tipo === "despesa" && t.status === "pago").reduce((s, t) => s + Number(t.valor), 0);
  const saldo = totalRecebido - totalDespesas;

  const porFaixa = Object.entries((alunos ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.faixa] = (acc[a.faixa] ?? 0) + 1;
    return acc;
  }, {})).map(([faixa, qtd]) => ({ faixa, qtd }));

  const cores = ["#e5e7eb", "#9ca3af", "#fde047", "#fb923c", "#16a34a", "#3b82f6", "#a855f7", "#92400e", "#0a0a0a"];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Kpi title="Total Recebido" value={fmtBRL(totalRecebido)} />
        <Kpi title="Total Pago (Despesas)" value={fmtBRL(totalDespesas)} />
        <Kpi title="Saldo" value={fmtBRL(saldo)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Distribuição de Alunos por Faixa</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porFaixa}>
                  <CartesianGrid stroke="oklch(0.22 0 0)" strokeDasharray="3 3" />
                  <XAxis dataKey="faixa" stroke="oklch(0.65 0 0)" fontSize={12} />
                  <YAxis stroke="oklch(0.65 0 0)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "oklch(0.11 0 0)", border: "1px solid oklch(0.22 0 0)", borderRadius: 8 }} />
                  <Bar dataKey="qtd" name="Alunos" radius={[6, 6, 0, 0]}>
                    {porFaixa.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <ExportacaoNotasFiscais />
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card><CardContent className="p-6">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </CardContent></Card>
  );
}

function ExportacaoNotasFiscais() {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!dataInicio || !dataFim) {
      toast.error("Informe a data inicial e final para gerar o relatório.");
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("transacoes")
        .select(`
          id,
          valor,
          data_pagamento,
          forma_pagamento,
          descricao,
          categoria,
          aluno:alunos(
            nome, 
            cpf, 
            email, 
            telefone, 
            endereco_rua, 
            endereco_numero, 
            endereco_bairro, 
            endereco_cidade, 
            endereco_uf, 
            endereco_cep,
            responsaveis(nome, cpf, email, telefone)
          ),
          contrato:contratos(
            planos(nome)
          )
        `)
        .eq("tipo", "receita")
        .eq("status", "pago")
        .gte("data_pagamento", dataInicio)
        .lte("data_pagamento", dataFim);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info("Nenhum pagamento encontrado neste período.");
        setLoading(false);
        return;
      }

      const relatorio = data.map((t: any) => {
        const aluno = Array.isArray(t.aluno) ? t.aluno[0] : t.aluno;
        const responsavel = aluno?.responsaveis ? (Array.isArray(aluno.responsaveis) ? aluno.responsaveis[0] : aluno.responsaveis) : null;
        
        // Define tomador com fallback para responsável financeiro
        const tomadorNome = responsavel?.nome || aluno?.nome || "N/I";
        const tomadorCPF = responsavel?.cpf || aluno?.cpf || "N/I";
        const tomadorEmail = responsavel?.email || aluno?.email || "";
        const tomadorTelefone = responsavel?.telefone || aluno?.telefone || "";

        // Tenta buscar o nome do plano se houver contrato
        const contrato = Array.isArray(t.contrato) ? t.contrato[0] : t.contrato;
        const plano = contrato?.planos ? (Array.isArray(contrato.planos) ? contrato.planos[0] : contrato.planos) : null;
        const descricaoServico = t.descricao || (plano?.nome ? `Plano ${plano.nome}` : t.categoria);

        return {
          "ID Transação": t.id,
          "Data Pagamento": t.data_pagamento ? format(new Date(t.data_pagamento), "dd/MM/yyyy") : "",
          "Valor Pago": t.valor,
          "Forma Pagamento": t.forma_pagamento || "",
          "Descrição Serviço": descricaoServico,
          "Nome Tomador": tomadorNome,
          "CPF Tomador": tomadorCPF,
          "CEP": aluno?.endereco_cep || "",
          "Rua": aluno?.endereco_rua || "",
          "Número": aluno?.endereco_numero || "",
          "Bairro": aluno?.endereco_bairro || "",
          "Cidade": aluno?.endereco_cidade || "",
          "UF": aluno?.endereco_uf || "",
          "Email Tomador": tomadorEmail,
          "Telefone Tomador": tomadorTelefone
        };
      });

      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(relatorio);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Pagamentos");
      
      const fileName = `NFS-e_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Relatório gerado com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar relatório: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-primary" />
          Exportação para NFS-e
        </CardTitle>
        <CardDescription>Gere um relatório Excel com os dados dos pagamentos e dos tomadores para a contabilidade emitir as notas fiscais.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dt-inicio">Data Inicial</Label>
              <Input 
                id="dt-inicio" 
                type="date" 
                value={dataInicio} 
                onChange={e => setDataInicio(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dt-fim">Data Final</Label>
              <Input 
                id="dt-fim" 
                type="date" 
                value={dataFim} 
                onChange={e => setDataFim(e.target.value)} 
              />
            </div>
          </div>
          
          <Button 
            className="w-full gap-2" 
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {loading ? "Gerando..." : "Baixar Relatório (Excel)"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
