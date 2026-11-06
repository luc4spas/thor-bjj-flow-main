# Atualização Thor BJJ — Plano de Execução

Vou dividir em **4 fases**, cada uma entregável e testável. Você valida ao final de cada uma antes de eu seguir.

---

## FASE 1 — Fundação: Schema + Cadastro + Contratos flexíveis

### Banco de dados (migration única)
- **`alunos`**: adicionar `observacoes text`, `endereco_rua`, `endereco_numero`, `endereco_bairro`, `endereco_cidade`, `endereco_cep`, `endereco_uf`, `titular_id uuid references alunos(id)` (para dependentes de Plano Família).
- **`planos`**: adicionar `tipo text check in ('mensal','semestral','anual','amigo','familia')`, `max_dependentes int default 0`, `cobranca text check in ('recorrente','a_vista')`.
- **`contratos`**: adicionar `titular_contrato_id uuid references contratos(id)` (para vincular Plano Amigo). Permitir múltiplos contratos ativos por aluno (para trocar plano).
- **Constraint dia_vencimento**: check `in (10,20,30)`.
- **Trigger `gerar_parcelas_contrato`**: reescrever para:
  - `cobranca='a_vista'` → gera **1 única transação** com valor total.
  - `cobranca='recorrente'` → mantém geração mensal atual.
  - Plano Amigo/Família → só gera parcelas no contrato do titular.
- **Seed** dos planos padrão (Mensal, Semestral, Anual, Amigo, Família) com tipos e cobrança corretos.

### UI
- `aluno-form-dialog.tsx`: nova aba **"Endereço"** (destacado como necessário para NF), campo **Observações** na aba Dados, selector de titular quando plano for Família.
- **Vencimento**: trocar `<Input type="number">` por `<Select>` com opções 10/20/30 (no dialog de aluno e nos formulários financeiros).
- **Editar contrato do aluno ativo**: novo botão "Trocar Plano" em `app.alunos.tsx` — abre dialog que cancela contrato atual (mantém parcelas já pagas) e cria novo, sem bloquear.

---

## FASE 2 — Planos Vinculados (Amigo / Família)

### Regras
- **Plano Família**: titular paga; dependentes cadastrados via `titular_id` no aluno. Dependentes têm cadastro completo (faixa, graus, frequência). Cobrança gerada apenas no titular. Ao consultar acessos, todos os vinculados ficam liberados se o titular está em dia.
- **Plano Amigo**: dois contratos vinculados via `titular_contrato_id`. Se um cancela → alerta na tela do outro sugerindo troca de plano (banner + toast).
- Validação: respeitar `max_dependentes` do plano.

### UI
- `app.alunos.tsx`: nova coluna/badge "Titular" ou "Dependente de X".
- Dialog do aluno: quando plano é Família e é dependente, campo obrigatório "Titular financeiro".
- Alerta visual quando parceiro de Plano Amigo cancela.

---

## FASE 3 — Financeiro, Frequência e Relatórios

### Extrato de Pagadores (para contador)
- Nova rota `/app/relatorios/pagadores` com filtro por período.
- Colunas: Nome, CPF, Endereço completo, Valor Pago, Data Pagamento, Forma.
- Botão **Exportar CSV** (client-side, sem dependência externa).

### Frequência
- Nova tabela **`checkins`** (`id`, `id_aluno`, `entrada timestamptz`, `saida timestamptz null`, `origem text check in ('manual','catraca')`).
- UI: botão "Registrar Entrada/Saída" na listagem de alunos + **Kiosk** simples em `/app/checkin` (busca por nome/CPF).
- Endpoint público **`/api/public/catraca/checkin`** (POST, HMAC verificado) para catraca física popular a mesma tabela.
- Nova rota `/app/relatorios/frequencia`: quem entrou/saiu no dia, incluindo responsáveis (join `alunos.id_responsavel → responsaveis`).

---

## FASE 4 — Mensageria + Integrações (Evolution API + Catraca)

### Evolution API (WhatsApp)
- **Secret**: peço `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` via `add_secret`.
- **Server function** `enviarWhatsApp({ telefone, mensagem })` chamando `POST {url}/message/sendText/{instance}`.
- **Tabela `mensagens`** para histórico (destinatário, texto, status, enviado_em, erro).
- Nova rota `/app/mensageria`:
  - Composer com template ("Mensagem para todos ativos", "Cobrança individual", "Livre").
  - Botão "Enviar para todos os alunos ativos" (loop com throttling).
- **Cobrança automática**: server function `dispararCobrancasVencendo()` que busca transações pendentes X dias antes/depois do vencimento e dispara template. Endpoint público `/api/public/cron/cobrancas` (protegido por `CRON_SECRET`) para você agendar externamente.

### Catraca — painel de integração
- Nova aba em `/app/configuracoes` → "Integrações":
  - Status da catraca (última batida recebida, health).
  - URL do webhook + secret para copiar/colar no fabricante.
  - Toggle "Bloquear catraca se aluno inadimplente" (grava em config).
- Endpoint público **`/api/public/catraca/autorizar`** (POST `{ cpf }`) → retorna `{ allow: bool, motivo }` consultando status financeiro.

---

## Detalhes técnicos

- **Stack**: TanStack Start + Supabase (Lovable Cloud). Sem edge functions novas — uso `createServerFn` e server routes em `src/routes/api/public/*`.
- **RLS**: novas tabelas (`checkins`, `mensagens`) seguem padrão existente — SELECT autenticado, WRITE admin/owner.
- **Validação**: Zod nos endpoints públicos + HMAC nas rotas de catraca.
- **CSV**: gerado no cliente via `Blob` (sem lib nova).
- **Types**: `src/integrations/supabase/types.ts` regenera após cada migration aprovada.

---

## Ordem de aprovação

Cada fase = 1 migration + código correspondente. Aprovo a migration → você valida a UI → próxima fase.

**Começo pela Fase 1** assim que aprovar este plano. Confirma?