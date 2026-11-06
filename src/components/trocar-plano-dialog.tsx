import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const DIAS_VENC = ["10", "20", "30"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  alunoId: string | null;
  alunoNome?: string;
}

export function TrocarPlanoDialog({ open, onOpenChange, onSaved, alunoId, alunoNome }: Props) {
  const [busy, setBusy] = useState(false);
  const [planoId, setPlanoId] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [valorTotal, setValorTotal] = useState("");
  const [diaVenc, setDiaVenc] = useState("10");
  const [cancelarAtual, setCancelarAtual] = useState(true);
  const [removerPendentes, setRemoverPendentes] = useState(true);

  const { data: planos } = useQuery({
    queryKey: ["planos"],
    queryFn: async () => (await supabase.from("planos").select("*").order("duracao_meses")).data ?? [],
  });

  const { data: contratoAtivo } = useQuery({
    queryKey: ["contrato-ativo", alunoId],
    enabled: !!alunoId && open,
    queryFn: async () => {
      const { data } = await supabase.from("contratos")
        .select("id,id_plano,data_inicio,valor_total,status")
        .eq("id_aluno", alunoId!).eq("status", "ativo")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const plano = planos?.find((p) => p.id === planoId);
  const isAvista = plano?.cobranca === "a_vista";

  useEffect(() => {
    if (!open) {
      setPlanoId(""); setValorTotal(""); setDiaVenc("10");
      setDataInicio(new Date().toISOString().slice(0, 10));
      setCancelarAtual(true); setRemoverPendentes(true);
    }
  }, [open]);

  useEffect(() => {
    if (plano && !valorTotal) setValorTotal(String(plano.valor_padrao));
  }, [plano, valorTotal]);

  async function salvar() {
    if (!alunoId) return;
    if (!planoId) return toast.error("Selecione o novo plano");
    if (!valorTotal) return toast.error("Informe o valor");

    setBusy(true);
    try {
      if (cancelarAtual && contratoAtivo) {
        const { error } = await supabase.from("contratos")
          .update({ status: "cancelado" }).eq("id", contratoAtivo.id);
        if (error) throw error;

        if (removerPendentes) {
          const { error: et } = await supabase.from("transacoes").delete()
            .eq("id_contrato", contratoAtivo.id).eq("status", "pendente");
          if (et) throw et;
        }
      }

      const inicio = new Date(dataInicio + "T00:00:00");
      const fim = new Date(inicio); fim.setMonth(fim.getMonth() + (plano?.duracao_meses ?? 1));

      const { error: ec } = await supabase.from("contratos").insert({
        id_aluno: alunoId,
        id_plano: planoId,
        data_inicio: dataInicio,
        data_fim: fim.toISOString().slice(0, 10),
        valor_total: Number(valorTotal),
        dia_vencimento: Number(diaVenc),
        status: "ativo",
      });
      if (ec) throw ec;

      toast.success("Plano trocado com sucesso");
      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erro ao trocar plano");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>Trocar Plano{alunoNome ? ` — ${alunoNome}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {contratoAtivo ? (
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div><b>Contrato ativo:</b> {planos?.find((p) => p.id === contratoAtivo.id_plano)?.nome ?? "—"}</div>
              <div>Início: {contratoAtivo.data_inicio} · Valor: R$ {Number(contratoAtivo.valor_total).toFixed(2)}</div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Nenhum contrato ativo — será criado o primeiro.
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Novo plano *</Label>
            <Select value={planoId} onValueChange={setPlanoId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {planos?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} — {p.duracao_meses}m — R$ {Number(p.valor_padrao).toFixed(2)}
                    {p.cobranca === "a_vista" ? " (à vista)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor *</Label>
              <Input type="number" step="0.01" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vencimento</Label>
              <Select value={diaVenc} onValueChange={setDiaVenc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DIAS_VENC.map((d) => <SelectItem key={d} value={d}>Dia {d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {isAvista && (
            <p className="text-xs text-muted-foreground">
              Plano à vista: cobrança única será gerada com o valor total.
            </p>
          )}

          {contratoAtivo && (
            <div className="space-y-2 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cancelarAtual} onChange={(e) => setCancelarAtual(e.target.checked)} />
                Cancelar contrato atual
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={removerPendentes}
                  disabled={!cancelarAtual}
                  onChange={(e) => setRemoverPendentes(e.target.checked)} />
                Remover parcelas <b>pendentes</b> do contrato antigo (parcelas já pagas ficam preservadas)
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>{busy ? "Salvando…" : "Trocar Plano"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
