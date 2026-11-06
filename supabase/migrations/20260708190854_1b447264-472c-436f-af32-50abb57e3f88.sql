
-- ==== ALUNOS ====
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS endereco_rua text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_cidade text,
  ADD COLUMN IF NOT EXISTS endereco_cep text,
  ADD COLUMN IF NOT EXISTS endereco_uf text,
  ADD COLUMN IF NOT EXISTS titular_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alunos_titular ON public.alunos(titular_id);

-- ==== PLANOS ====
DO $$ BEGIN
  CREATE TYPE public.plano_tipo AS ENUM ('mensal','semestral','anual','amigo','familia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plano_cobranca AS ENUM ('recorrente','a_vista');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS tipo public.plano_tipo NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS cobranca public.plano_cobranca NOT NULL DEFAULT 'recorrente',
  ADD COLUMN IF NOT EXISTS max_dependentes int NOT NULL DEFAULT 0;

INSERT INTO public.planos (nome, duracao_meses, valor_padrao, tipo, cobranca, max_dependentes)
VALUES
  ('Mensal',    1,  250.00, 'mensal',    'recorrente', 0),
  ('Semestral', 6, 1350.00, 'semestral', 'a_vista',    0),
  ('Anual',    12, 2400.00, 'anual',     'a_vista',    0),
  ('Amigo',     1,  200.00, 'amigo',     'recorrente', 0),
  ('Família',   1,  180.00, 'familia',   'recorrente', 4)
ON CONFLICT DO NOTHING;

-- ==== CONTRATOS ====
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS titular_contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contratos_titular ON public.contratos(titular_contrato_id);

-- Regra 10/20/30 vale para novos registros; antigos ficam como estão
ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_dia_vencimento_check;
ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_dia_vencimento_check CHECK (dia_vencimento IN (10,20,30)) NOT VALID;

-- ==== TRIGGER ====
CREATE OR REPLACE FUNCTION public.gerar_parcelas_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_duracao INT;
  v_cobranca public.plano_cobranca;
  v_tipo public.plano_tipo;
  v_titular uuid;
  v_valor_parcela NUMERIC(10,2);
  i INT;
  v_venc DATE;
BEGIN
  SELECT duracao_meses, cobranca, tipo
    INTO v_duracao, v_cobranca, v_tipo
    FROM public.planos WHERE id = NEW.id_plano;

  SELECT titular_id INTO v_titular FROM public.alunos WHERE id = NEW.id_aluno;
  IF v_tipo = 'familia' AND v_titular IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_cobranca = 'a_vista' THEN
    v_venc := (date_trunc('month', NEW.data_inicio) + ((NEW.dia_vencimento - 1) || ' day')::interval)::date;
    INSERT INTO public.transacoes
      (id_aluno, id_contrato, tipo, categoria, descricao, valor, data_vencimento, status)
    VALUES
      (NEW.id_aluno, NEW.id, 'receita', 'Mensalidade',
       'Pagamento à vista (' || v_duracao || ' meses)',
       NEW.valor_total, v_venc, 'pendente');
    RETURN NEW;
  END IF;

  v_valor_parcela := ROUND(NEW.valor_total / v_duracao, 2);
  FOR i IN 0..(v_duracao - 1) LOOP
    v_venc := (date_trunc('month', NEW.data_inicio) + (i || ' month')::interval)::date
              + (NEW.dia_vencimento - 1);
    INSERT INTO public.transacoes
      (id_aluno, id_contrato, tipo, categoria, descricao, valor, data_vencimento, status)
    VALUES
      (NEW.id_aluno, NEW.id, 'receita', 'Mensalidade',
       'Parcela ' || (i+1) || '/' || v_duracao,
       v_valor_parcela, v_venc, 'pendente');
  END LOOP;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_gerar_parcelas_contrato ON public.contratos;
CREATE TRIGGER trg_gerar_parcelas_contrato
  AFTER INSERT ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_contrato();
