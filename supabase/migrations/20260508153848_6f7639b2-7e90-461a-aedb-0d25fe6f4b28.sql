
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner','admin','instructor');
CREATE TYPE public.transacao_tipo AS ENUM ('receita','despesa');
CREATE TYPE public.transacao_status AS ENUM ('pago','pendente');
CREATE TYPE public.contrato_status AS ENUM ('ativo','cancelado');

-- ============ PERFIS ============
CREATE TABLE public.perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  role public.app_role NOT NULL DEFAULT 'instructor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Função segura para checar role (evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE id = _user_id AND role IN ('owner','admin'));
$$;

-- Trigger para criar perfil ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email,
    -- primeiro usuário vira owner
    CASE WHEN (SELECT COUNT(*) FROM public.perfis) = 0 THEN 'owner'::public.app_role
         ELSE 'instructor'::public.app_role END
  );
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PLANOS ============
CREATE TABLE public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  duracao_meses INT NOT NULL CHECK (duracao_meses > 0),
  valor_padrao NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

-- ============ RESPONSAVEIS ============
CREATE TABLE public.responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;

-- ============ ALUNOS ============
CREATE TABLE public.alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  data_nascimento DATE,
  faixa TEXT NOT NULL DEFAULT 'Branca',
  graus INT NOT NULL DEFAULT 0,
  id_responsavel UUID REFERENCES public.responsaveis(id) ON DELETE SET NULL,
  telefone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

-- ============ CONTRATOS ============
CREATE TABLE public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_aluno UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  id_plano UUID NOT NULL REFERENCES public.planos(id),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  valor_total NUMERIC(10,2) NOT NULL,
  dia_vencimento INT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 28),
  status public.contrato_status NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- ============ TRANSACOES ============
CREATE TABLE public.transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_aluno UUID REFERENCES public.alunos(id) ON DELETE SET NULL,
  id_contrato UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo public.transacao_tipo NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status public.transacao_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_transacoes_status ON public.transacoes(status);
CREATE INDEX idx_transacoes_venc ON public.transacoes(data_vencimento);

-- ============ TRIGGER: gerar parcelas ao criar contrato ============
CREATE OR REPLACE FUNCTION public.gerar_parcelas_contrato()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_duracao INT;
  v_valor_parcela NUMERIC(10,2);
  i INT;
  v_venc DATE;
BEGIN
  SELECT duracao_meses INTO v_duracao FROM public.planos WHERE id = NEW.id_plano;
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
END $$;

CREATE TRIGGER trg_gerar_parcelas
AFTER INSERT ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_contrato();

-- ============ RLS POLICIES ============
-- perfis: usuário lê o próprio perfil; owner/admin lê todos
CREATE POLICY "perfis_self_select" ON public.perfis FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "perfis_admin_select_all" ON public.perfis FOR SELECT TO authenticated USING (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "perfis_admin_update" ON public.perfis FOR UPDATE TO authenticated USING (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "perfis_self_update" ON public.perfis FOR UPDATE TO authenticated USING (auth.uid() = id);

-- planos
CREATE POLICY "planos_select" ON public.planos FOR SELECT TO authenticated USING (true);
CREATE POLICY "planos_write" ON public.planos FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid())) WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- responsaveis
CREATE POLICY "resp_select" ON public.responsaveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "resp_write" ON public.responsaveis FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- alunos
CREATE POLICY "alunos_select" ON public.alunos FOR SELECT TO authenticated USING (true);
CREATE POLICY "alunos_write" ON public.alunos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- contratos
CREATE POLICY "contratos_select" ON public.contratos FOR SELECT TO authenticated USING (true);
CREATE POLICY "contratos_write" ON public.contratos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- transacoes: somente owner/admin acessam financeiro
CREATE POLICY "trans_select_admin" ON public.transacoes FOR SELECT TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "trans_write_admin" ON public.transacoes FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid())) WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- ============ SEED de planos padrão ============
INSERT INTO public.planos (nome, duracao_meses, valor_padrao) VALUES
  ('Mensal', 1, 200.00),
  ('Trimestral', 3, 540.00),
  ('Semestral', 6, 990.00),
  ('Anual', 12, 1800.00);
