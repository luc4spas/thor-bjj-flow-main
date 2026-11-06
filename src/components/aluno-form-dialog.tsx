
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const FAIXAS = ["Branca", "Cinza", "Amarela", "Laranja", "Verde", "Azul", "Roxa", "Marrom", "Preta"];
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const DIAS_VENC = ["10", "20", "30"];

export interface AlunoEditPayload {
  id: string;
  nome: string;
  data_nascimento: string | null;
  faixa: string;
  graus: number;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  id_responsavel: string | null;
  observacoes?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_cep?: string | null;
  endereco_uf?: string | null;
  titular_id?: string | null;
}

function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskCEP(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  aluno?: AlunoEditPayload | null;
}

export function AlunoFormDialog({ open, onOpenChange, onSaved, aluno }: Props) {
  const isEdit = !!aluno;
  const [tab, setTab] = useState("dados");
  const [busy, setBusy] = useState(false);

  // Aluno
  const [nome, setNome] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [faixa, setFaixa] = useState("Branca");
  const [graus, setGraus] = useState("0");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [observacoes, setObservacoes] = useState("");
  // Endereço
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [cep, setCep] = useState("");
  const [uf, setUf] = useState("");
  // Responsavel
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respTel, setRespTel] = useState("");
  const [respEmail, setRespEmail] = useState("");
  // Contrato (só na criação)
  const [planoId, setPlanoId] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [valorTotal, setValorTotal] = useState("");
  const [diaVenc, setDiaVenc] = useState("10");
  const [titularId, setTitularId] = useState<string>("");
  const [titularContratoAmigoId, setTitularContratoAmigoId] = useState<string>("");

  const { data: planos } = useQuery({
    queryKey: ["planos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("planos").select("*").order("duracao_meses");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Titulares existentes de Plano Família (alunos que já são titulares de um contrato família ativo)
  const { data: titularesFamilia } = useQuery({
    queryKey: ["titulares-familia-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id_aluno, aluno:alunos!inner(id,nome,titular_id), plano:planos!inner(tipo)")
        .eq("status", "ativo")
        .eq("plano.tipo", "familia");
      if (error) throw error;
      const seen = new Set<string>();
      const out: { id: string; nome: string }[] = [];
      for (const row of (data ?? []) as Array<{ aluno: { id: string; nome: string; titular_id: string | null } }>) {
        if (row.aluno && !row.aluno.titular_id && !seen.has(row.aluno.id)) {
          seen.add(row.aluno.id);
          out.push({ id: row.aluno.id, nome: row.aluno.nome });
        }
      }
      return out.sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  // Dependentes já vinculados ao titular selecionado (mostrar quem já está na família)
  const { data: dependentesDoTitular } = useQuery({
    queryKey: ["dependentes-do-titular", titularId],
    enabled: !!titularId && titularId !== "__none__",
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos")
        .select("id,nome").eq("titular_id", titularId).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Contratos de Plano Amigo ativos, sem par ainda (disponíveis para vincular)
  const { data: contratosAmigoDisponiveis } = useQuery({
    queryKey: ["contratos-amigo-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id, titular_contrato_id, aluno:alunos!inner(id,nome), plano:planos!inner(tipo)")
        .eq("status", "ativo")
        .eq("plano.tipo", "amigo");
      if (error) throw error;
      const rows = (data ?? []) as Array<{ id: string; titular_contrato_id: string | null; aluno: { id: string; nome: string } }>;
      const linkedTargets = new Set(rows.map((r) => r.titular_contrato_id).filter(Boolean) as string[]);
      // disponível = contrato que não aponta pra outro (é titular) e ninguém aponta pra ele ainda
      return rows
        .filter((r) => !r.titular_contrato_id && !linkedTargets.has(r.id))
        .map((r) => ({ id: r.id, nome: r.aluno.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  const planoSelecionado = planos?.find((p) => p.id === planoId);
  const isFamilia = planoSelecionado?.tipo === "familia";
  const isAmigo = planoSelecionado?.tipo === "amigo";
  const isAvista = planoSelecionado?.cobranca === "a_vista";

  // Contrato ativo do aluno em edição (para permitir vincular a família/amigo)
  const { data: contratoAtual } = useQuery({
    queryKey: ["contrato-atual", aluno?.id],
    enabled: !!aluno?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("id, titular_contrato_id, id_plano, plano:planos!inner(tipo,nome)")
        .eq("id_aluno", aluno!.id)
        .eq("status", "ativo")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const editIsFamilia = (contratoAtual?.plano as { tipo?: string } | undefined)?.tipo === "familia";
  const editIsAmigo = (contratoAtual?.plano as { tipo?: string } | undefined)?.tipo === "amigo";


  useEffect(() => {
    if (!open) return;
    setTab("dados");
    if (aluno) {
      setNome(aluno.nome);
      setDataNasc(aluno.data_nascimento ?? "");
      setFaixa(aluno.faixa);
      setGraus(String(aluno.graus));
      setTelefone(aluno.telefone ?? "");
      setEmail(aluno.email ?? "");
      setCpf(aluno.cpf ? maskCPF(aluno.cpf) : "");
      setObservacoes(aluno.observacoes ?? "");
      setRua(aluno.endereco_rua ?? "");
      setNumero(aluno.endereco_numero ?? "");
      setBairro(aluno.endereco_bairro ?? "");
      setCidade(aluno.endereco_cidade ?? "");
      setCep(aluno.endereco_cep ? maskCEP(aluno.endereco_cep) : "");
      setUf(aluno.endereco_uf ?? "");
      setTitularId(aluno.titular_id ?? "");
      if (aluno.id_responsavel) {
        supabase.from("responsaveis").select("*").eq("id", aluno.id_responsavel).maybeSingle()
          .then(({ data }) => {
            if (data) {
              setRespNome(data.nome ?? "");
              setRespCpf(data.cpf ?? "");
              setRespTel(data.telefone ?? "");
              setRespEmail(data.email ?? "");
            }
          });
      } else {
        setRespNome(""); setRespCpf(""); setRespTel(""); setRespEmail("");
      }
    } else {
      setNome(""); setDataNasc(""); setFaixa("Branca"); setGraus("0");
      setTelefone(""); setEmail(""); setCpf(""); setObservacoes("");
      setRua(""); setNumero(""); setBairro(""); setCidade(""); setCep(""); setUf("");
      setRespNome(""); setRespCpf(""); setRespTel(""); setRespEmail("");
      setPlanoId(""); setValorTotal(""); setDiaVenc("10"); setTitularId(""); setTitularContratoAmigoId("");
      setDataInicio(new Date().toISOString().slice(0, 10));
    }
  }, [open, aluno]);

  useEffect(() => {
    if (planoId && planos && !isEdit) {
      const p = planos.find((x) => x.id === planoId);
      if (p && !valorTotal) setValorTotal(String(p.valor_padrao));
    }
  }, [planoId, planos, isEdit, valorTotal]);

  useEffect(() => {
    if (isEdit && contratoAtual?.titular_contrato_id) {
      setTitularContratoAmigoId(contratoAtual.titular_contrato_id);
    }
  }, [isEdit, contratoAtual]);

  async function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome do aluno");
    if (!isEdit) {
      if (!planoId) return toast.error("Selecione um plano (contrato é obrigatório)");
      if (!valorTotal) return toast.error("Informe o valor total do contrato");
      if (isFamilia && !titularId) {
        // Sem titular = está criando o titular; ok
      }
    }

    setBusy(true);
    try {
      let idResponsavel: string | null = aluno?.id_responsavel ?? null;
      if (respNome.trim()) {
        if (idResponsavel) {
          const { error } = await supabase.from("responsaveis").update({
            nome: respNome, cpf: respCpf || null, telefone: respTel || null, email: respEmail || null,
          }).eq("id", idResponsavel);
          if (error) throw error;
        } else {
          const { data: r, error: er } = await supabase.from("responsaveis").insert({
            nome: respNome, cpf: respCpf || null, telefone: respTel || null, email: respEmail || null,
          }).select("id").single();
          if (er) throw er;
          idResponsavel = r.id;
        }
      }

      const titularIdFinal = isEdit
        ? (editIsFamilia ? (titularId && titularId !== "__none__" ? titularId : null) : (aluno?.titular_id ?? null))
        : ((isFamilia && titularId && titularId !== "__none__") ? titularId : null);

      const payloadAluno = {
        nome, data_nascimento: dataNasc || null, faixa, graus: Number(graus),
        telefone: telefone || null, email: email || null, cpf: cpf || null,
        id_responsavel: idResponsavel,
        observacoes: observacoes || null,
        endereco_rua: rua || null, endereco_numero: numero || null,
        endereco_bairro: bairro || null, endereco_cidade: cidade || null,
        endereco_cep: cep || null, endereco_uf: uf || null,
        titular_id: titularIdFinal,
      };

      if (isEdit) {
        const { error } = await supabase.from("alunos").update(payloadAluno).eq("id", aluno!.id);
        if (error) throw error;
        // atualiza vínculo de amigo no contrato ativo
        if (editIsAmigo && contratoAtual?.id) {
          const novoTitularContrato = titularContratoAmigoId && titularContratoAmigoId !== "__none__"
            ? titularContratoAmigoId : null;
          const { error: eu } = await supabase.from("contratos")
            .update({ titular_contrato_id: novoTitularContrato })
            .eq("id", contratoAtual.id);
          if (eu) throw eu;
        }
        toast.success("Aluno atualizado");
      } else {
        const { data: alunoNovo, error: ea } = await supabase.from("alunos")
          .insert(payloadAluno).select("id").single();
        if (ea) throw ea;

        const plano = planos?.find((p) => p.id === planoId)!;
        const inicio = new Date(dataInicio + "T00:00:00");
        const fim = new Date(inicio); fim.setMonth(fim.getMonth() + plano.duracao_meses);

        const { error: ec } = await supabase.from("contratos").insert({
          id_aluno: alunoNovo.id,
          id_plano: planoId,
          data_inicio: dataInicio,
          data_fim: fim.toISOString().slice(0, 10),
          valor_total: Number(valorTotal),
          dia_vencimento: Number(diaVenc),
          status: "ativo",
          titular_contrato_id: (isAmigo && titularContratoAmigoId && titularContratoAmigoId !== "__none__")
            ? titularContratoAmigoId : null,
        });
        if (ec) throw ec;


        if (isFamilia && titularId) {
          toast.success("Dependente cadastrado — cobrança fica atrelada ao titular");
        } else if (isAvista) {
          toast.success("Aluno cadastrado — cobrança única gerada (pagamento à vista)");
        } else {
          toast.success("Aluno cadastrado e parcelas geradas!");
        }
      }

      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erro ao salvar");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Aluno" : "Novo Aluno"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="endereco">Endereço *</TabsTrigger>
            <TabsTrigger value="resp">Responsável</TabsTrigger>
            {!isEdit && <TabsTrigger value="contrato">Contrato *</TabsTrigger>}
            {isEdit && <TabsTrigger value="vinculos">Vínculos</TabsTrigger>}
          </TabsList>

          <TabsContent value="dados" className="space-y-4 pt-4">
            <Field label="Nome *"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Data de Nascimento"><Input type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} /></Field>
              <Field label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="CPF"><Input value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" /></Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Faixa">
                <Select value={faixa} onValueChange={setFaixa}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FAIXAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Graus"><Input type="number" min={0} max={4} value={graus} onChange={(e) => setGraus(e.target.value)} /></Field>
            </div>
            <Field label="Observações internas">
              <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Anotações da equipe (não visível ao aluno)" />
            </Field>
          </TabsContent>

          <TabsContent value="endereco" className="space-y-4 pt-4">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ Necessário para emissão de Nota Fiscal
            </p>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Rua / Logradouro"><Input value={rua} onChange={(e) => setRua(e.target.value)} /></Field>
              <Field label="Número"><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Bairro"><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></Field>
              <Field label="CEP"><Input value={cep} onChange={(e) => setCep(maskCEP(e.target.value))} placeholder="00000-000" inputMode="numeric" /></Field>
            </div>
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <Field label="Cidade"><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></Field>
              <Field label="UF">
                <Select value={uf} onValueChange={setUf}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="resp" className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">Opcional para alunos maiores de idade</p>
            <Field label="Nome"><Input value={respNome} onChange={(e) => setRespNome(e.target.value)} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="CPF"><Input value={respCpf} onChange={(e) => setRespCpf(e.target.value)} /></Field>
              <Field label="Telefone"><Input value={respTel} onChange={(e) => setRespTel(e.target.value)} /></Field>
            </div>
            <Field label="E-mail"><Input value={respEmail} onChange={(e) => setRespEmail(e.target.value)} /></Field>
          </TabsContent>

          {!isEdit && (
            <TabsContent value="contrato" className="space-y-4 pt-4">
              <Field label="Plano *">
                <Select value={planoId} onValueChange={setPlanoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                  <SelectContent>
                    {planos?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} — {p.duracao_meses}m — R$ {Number(p.valor_padrao).toFixed(2)}
                        {p.cobranca === "a_vista" ? " (à vista)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {isFamilia && (
                <>
                  <Field label="Titular financeiro (deixe vazio se este aluno for o titular)">
                    <Select value={titularId} onValueChange={setTitularId}>
                      <SelectTrigger><SelectValue placeholder="— este aluno é o titular —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— este aluno é o titular —</SelectItem>
                        {titularesFamilia && titularesFamilia.length > 0 && (
                          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Famílias existentes
                          </div>
                        )}
                        {titularesFamilia?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {titularId && titularId !== "__none__" && (
                    <div className="rounded-md border bg-muted/40 p-3 text-xs">
                      <div className="font-medium mb-1">
                        Participantes da família de{" "}
                        {titularesFamilia?.find((t) => t.id === titularId)?.nome}:
                      </div>
                      {dependentesDoTitular && dependentesDoTitular.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5">
                          {dependentesDoTitular.map((d) => <li key={d.id}>{d.nome}</li>)}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">Nenhum dependente ainda — este será o primeiro.</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {isAmigo && (
                <Field label="Parceiro de treino (vincular a um Plano Amigo existente)">
                  <Select value={titularContratoAmigoId} onValueChange={setTitularContratoAmigoId}>
                    <SelectTrigger><SelectValue placeholder="— novo Plano Amigo (sem parceiro ainda) —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— novo Plano Amigo (sem parceiro ainda) —</SelectItem>
                      {contratosAmigoDisponiveis && contratosAmigoDisponiveis.length > 0 && (
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Aguardando parceiro
                        </div>
                      )}
                      {contratosAmigoDisponiveis?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <div className="grid grid-cols-3 gap-3">

                <Field label="Data Início"><Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></Field>
                <Field label={isAvista ? "Valor Total * (à vista)" : "Valor Total *"}>
                  <Input type="number" step="0.01" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
                </Field>
                <Field label="Dia Vencimento">
                  <Select value={diaVenc} onValueChange={setDiaVenc}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DIAS_VENC.map((d) => <SelectItem key={d} value={d}>Dia {d}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              {isAvista ? (
                <p className="text-xs text-muted-foreground">
                  Plano à vista: será criada <b>uma única cobrança</b> com o valor total.
                </p>
              ) : isFamilia && titularId && titularId !== "__none__" ? (
                <p className="text-xs text-muted-foreground">
                  Dependente de Plano Família: <b>não gera cobrança própria</b> — o titular paga.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Plano recorrente: parcelas mensais geradas automaticamente conforme a duração.
                </p>
              )}
            </TabsContent>
          )}

          {isEdit && (
            <TabsContent value="vinculos" className="space-y-4 pt-4">
              {!contratoAtual ? (
                <p className="text-sm text-muted-foreground">
                  Este aluno não possui contrato ativo. Vínculos de Família/Amigo dependem de um contrato ativo.
                </p>
              ) : (
                <>
                  <div className="rounded-md border bg-muted/40 p-3 text-xs">
                    <div className="font-medium">Contrato ativo</div>
                    <div className="text-muted-foreground">
                      Plano: {(contratoAtual.plano as { nome?: string })?.nome} — tipo{" "}
                      <b>{(contratoAtual.plano as { tipo?: string })?.tipo}</b>
                    </div>
                  </div>

                  {editIsFamilia && (
                    <>
                      <Field label="Titular financeiro (deixe vazio se este aluno for o titular)">
                        <Select value={titularId || "__none__"} onValueChange={setTitularId}>
                          <SelectTrigger><SelectValue placeholder="— este aluno é o titular —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— este aluno é o titular —</SelectItem>
                            {titularesFamilia
                              ?.filter((t) => t.id !== aluno?.id)
                              .map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      {titularId && titularId !== "__none__" && (
                        <div className="rounded-md border bg-muted/40 p-3 text-xs">
                          <div className="font-medium mb-1">
                            Participantes da família de{" "}
                            {titularesFamilia?.find((t) => t.id === titularId)?.nome}:
                          </div>
                          {dependentesDoTitular && dependentesDoTitular.length > 0 ? (
                            <ul className="list-disc list-inside space-y-0.5">
                              {dependentesDoTitular.map((d) => <li key={d.id}>{d.nome}</li>)}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground">Nenhum dependente ainda.</p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Ao vincular este aluno a um titular, ele deixa de gerar cobrança própria — o titular passa a pagar.
                      </p>
                    </>
                  )}

                  {editIsAmigo && (
                    <Field label="Parceiro de treino (vincular a um Plano Amigo existente)">
                      <Select
                        value={titularContratoAmigoId || "__none__"}
                        onValueChange={setTitularContratoAmigoId}
                      >
                        <SelectTrigger><SelectValue placeholder="— sem parceiro ainda —" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— sem parceiro ainda —</SelectItem>
                          {contratosAmigoDisponiveis
                            ?.filter((c) => c.id !== contratoAtual.id)
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  {!editIsFamilia && !editIsAmigo && (
                    <p className="text-sm text-muted-foreground">
                      O contrato atual não é de Família nem Amigo. Para alterar, use "Trocar plano" na lista de alunos.
                    </p>
                  )}
                </>
              )}
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>{busy ? "Salvando…" : isEdit ? "Salvar Alterações" : "Salvar Aluno"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
