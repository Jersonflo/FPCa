-- ============================================================
-- Migración 2026-11-15 — Dinero por proyecto
-- Ejecutar UNA vez en Supabase → SQL Editor (es seguro repetirla).
-- (También está incluida en supabase-schema.sql)
-- ============================================================

-- En cuánto se negoció/vendió el proyecto (opcional)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agreed_amount NUMERIC(14,2);

-- Pagos recibidos por proyecto (no se mezclan con Finanzas)
CREATE TABLE IF NOT EXISTS project_payments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_payments_project ON project_payments(project_id);

ALTER TABLE project_payments ENABLE ROW LEVEL SECURITY;
