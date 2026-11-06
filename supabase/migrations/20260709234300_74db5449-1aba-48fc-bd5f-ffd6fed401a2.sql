
-- Tabela de check-ins (frequência)
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_aluno UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  origem TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'catraca'
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkins_aluno_data_idx ON public.checkins (id_aluno, data_hora DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY checkins_select ON public.checkins
  FOR SELECT TO authenticated USING (true);

CREATE POLICY checkins_write ON public.checkins
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Função para validar limite de dependentes ao vincular a um titular
CREATE OR REPLACE FUNCTION public.check_family_dependents_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT;
  v_count INT;
BEGIN
  IF NEW.titular_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- pega max_dependentes do contrato ativo do titular
  SELECT p.max_dependentes INTO v_max
  FROM public.contratos c
  JOIN public.planos p ON p.id = c.id_plano
  WHERE c.id_aluno = NEW.titular_id
    AND c.status = 'ativo'
    AND p.tipo = 'familia'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Titular selecionado não possui contrato ativo do tipo Família';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.alunos
  WHERE titular_id = NEW.titular_id
    AND id <> NEW.id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Limite de dependentes (%) já atingido para este titular', v_max;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_check_family_dependents ON public.alunos;
CREATE TRIGGER trg_check_family_dependents
  BEFORE INSERT OR UPDATE OF titular_id ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.check_family_dependents_limit();
