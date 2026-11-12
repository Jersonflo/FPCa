-- ============================================================
-- SCHEMA COMPLETO — Dashboard Personal
-- Pegar en Supabase SQL Editor y ejecutar
-- ============================================================

-- ─── PROYECTOS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE'
              CHECK (status IN ('ACTIVE', 'INACTIVE', 'PAUSED', 'ARCHIVED')),
  color       TEXT DEFAULT '#6366f1',
  url         TEXT,
  stack       TEXT[] DEFAULT '{}',
  position_x  FLOAT DEFAULT 0,
  position_y  FLOAT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Cuentas vinculadas a proyectos
CREATE TABLE IF NOT EXISTS accounts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,  -- GitHub, Vercel, Firebase, etc.
  username    TEXT,
  url         TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FINANZAS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cards (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  bank        TEXT NOT NULL,
  last_four   TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'DEBIT'
              CHECK (type IN ('DEBIT', 'CREDIT')),
  credit_limit NUMERIC(12,2),
  balance     NUMERIC(12,2) DEFAULT 0,
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount      NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  type        TEXT NOT NULL
              CHECK (type IN ('INCOME', 'FIXED', 'VARIABLE', 'SAVINGS')),
  category    TEXT NOT NULL,
  card_id     UUID REFERENCES cards(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  target      NUMERIC(12,2) NOT NULL,
  current     NUMERIC(12,2) DEFAULT 0,
  deadline    DATE,
  color       TEXT DEFAULT '#10b981',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDICES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_accounts_project ON accounts(project_id);

-- ─── TRIGGER updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

