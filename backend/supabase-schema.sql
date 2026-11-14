-- ============================================================
-- SCHEMA COMPLETO — Dashboard Personal
-- Pegar en Supabase → SQL Editor y ejecutar.
-- Es seguro ejecutarlo varias veces: crea lo que falta y
-- actualiza lo existente sin borrar datos.
-- ============================================================

-- ─── PROYECTOS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE',
  color       TEXT DEFAULT '#6366f1',
  url         TEXT,
  stack       TEXT[] DEFAULT '{}',
  position_x  FLOAT,
  position_y  FLOAT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Estados: activo, pausado, inactivo, terminado (proyectos ya hechos) y archivado
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('ACTIVE', 'PAUSED', 'INACTIVE', 'COMPLETED', 'ARCHIVED'));

-- Cuentas vinculadas a proyectos
CREATE TABLE IF NOT EXISTS accounts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,  -- GitHub, Vercel, Firebase, etc.
  username    TEXT,
  url         TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Conexiones/aristas entre nodos del grafo
CREATE TABLE IF NOT EXISTS project_connections (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  target_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  label       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id)
);

-- ─── TAREAS (tablero tipo Trello) ────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'TODO'
                CHECK (status IN ('BACKLOG', 'TODO', 'DOING', 'DONE')),
  priority      TEXT NOT NULL DEFAULT 'MEDIUM'
                CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  due_date      DATE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  labels        TEXT[] DEFAULT '{}',
  checklist     JSONB DEFAULT '[]',   -- [{ "text": "...", "done": false }]
  position      FLOAT NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FINANZAS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cards (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  bank         TEXT NOT NULL,
  last_four    TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT 'DEBIT'
               CHECK (type IN ('DEBIT', 'CREDIT')),
  credit_limit NUMERIC(14,2),
  balance      NUMERIC(14,2) DEFAULT 0,
  color        TEXT DEFAULT '#6366f1',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount      NUMERIC(14,2) NOT NULL,
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
  target      NUMERIC(14,2) NOT NULL,
  current     NUMERIC(14,2) DEFAULT 0,
  deadline    DATE,
  color       TEXT DEFAULT '#10b981',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Presupuesto mensual por categoría de gasto
CREATE TABLE IF NOT EXISTS budgets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category    TEXT NOT NULL UNIQUE,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUTENTICACIÓN ───────────────────────────────────────────
-- Tokens de Google guardados en el servidor (antes iban dentro del JWT)
CREATE TABLE IF NOT EXISTS google_tokens (
  email          TEXT PRIMARY KEY,
  access_token   TEXT,
  refresh_token  TEXT,
  expiry_date    BIGINT,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDICES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_accounts_project ON accounts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_connections_source ON project_connections(source_id);
CREATE INDEX IF NOT EXISTS idx_project_connections_target ON project_connections(target_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_position ON tasks(status, position);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- ─── TRIGGER updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SEGURIDAD: Row Level Security ───────────────────────────
-- Con RLS activado y SIN políticas, nadie puede leer/escribir estas tablas
-- usando la clave pública (anon). Solo el backend, que usa la service_role,
-- tiene acceso. Esto cierra el acceso directo a tus datos desde internet.
ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards               ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_tokens       ENABLE ROW LEVEL SECURITY;
