-- Create enum for payment methods
DO $$ BEGIN
  CREATE TYPE public.forma_pagamento AS ENUM (
    'dinheiro',
    'pix',
    'cartao_credito',
    'cartao_debito',
    'boleto',
    'transferencia',
    'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS forma_pagamento public.forma_pagamento;