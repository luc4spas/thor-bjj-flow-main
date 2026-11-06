-- Migration: Add 'codigo' to 'alunos' table for Catraca integration
-- Run this snippet in your Supabase SQL Editor

ALTER TABLE alunos ADD COLUMN IF NOT EXISTS codigo SERIAL;

-- If you want to use the 'codigo' for existing students, they will automatically get a sequential number.
-- You can verify with:
-- SELECT id, nome, codigo FROM alunos;
