-- ============================================================
-- Migración 2026-11-16 — Plataformas y cuentas como nodos de la red
-- Ejecutar en Supabase → SQL Editor (es seguro repetirla).
--
--   Plataforma (Supabase, Vercel, GitHub…)  ← nodo "hub", uno por plataforma
--     └─ Cuentas de esa plataforma          ← platform_accounts
--          └─ Proyectos que usan la cuenta   ← project_platform_links
-- ============================================================

-- Cuentas (ej. Supabase "personal", Supabase "cliente X")
CREATE TABLE IF NOT EXISTS platform_accounts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform    TEXT NOT NULL,          -- clave: 'supabase', 'vercel', 'github', 'github-pages'…
  name        TEXT NOT NULL,          -- cómo la identificas ("Personal", "Cliente X")
  username    TEXT,                   -- correo, usuario u organización
  url         TEXT,                   -- link al panel
  notes       TEXT,
  position_x  FLOAT,
  position_y  FLOAT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(platform);

-- Qué proyecto usa qué cuenta
CREATE TABLE IF NOT EXISTS project_platform_links (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, account_id)
);

-- Posición del nodo de cada plataforma en la red
CREATE TABLE IF NOT EXISTS platform_hubs (
  platform    TEXT PRIMARY KEY,
  position_x  FLOAT NOT NULL,
  position_y  FLOAT NOT NULL
);

ALTER TABLE platform_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_platform_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_hubs          ENABLE ROW LEVEL SECURITY;

-- ─── Pasar las "cuentas vinculadas" antiguas al nuevo modelo ───
-- Solo se ejecuta si la tabla nueva está vacía (para no duplicar al repetir).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform_accounts) AND EXISTS (SELECT 1 FROM accounts) THEN
    -- Una cuenta por cada (plataforma, usuario) distinto
    INSERT INTO platform_accounts (platform, name, username, url)
    SELECT DISTINCT ON (k, u)
      k,
      COALESCE(NULLIF(TRIM(username), ''), 'Principal'),
      NULLIF(TRIM(username), ''),
      url
    FROM (
      SELECT
        CASE lower(regexp_replace(platform, '\s+', '', 'g'))
          WHEN 'dockerhub' THEN 'docker'
          WHEN 'githubpages' THEN 'github-pages'
          ELSE lower(regexp_replace(platform, '\s+', '', 'g'))
        END AS k,
        lower(COALESCE(TRIM(username), '')) AS u,
        username, url
      FROM accounts
    ) a;

    -- Enlazar cada proyecto con su cuenta
    INSERT INTO project_platform_links (project_id, account_id)
    SELECT DISTINCT a.project_id, pa.id
    FROM accounts a
    JOIN platform_accounts pa
      ON pa.platform = CASE lower(regexp_replace(a.platform, '\s+', '', 'g'))
                         WHEN 'dockerhub' THEN 'docker'
                         WHEN 'githubpages' THEN 'github-pages'
                         ELSE lower(regexp_replace(a.platform, '\s+', '', 'g'))
                       END
     AND lower(COALESCE(pa.username, '')) = lower(COALESCE(TRIM(a.username), ''))
    WHERE a.project_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
