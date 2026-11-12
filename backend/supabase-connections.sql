-- Tabla para guardar conexiones/aristas entre nodos del grafo
CREATE TABLE IF NOT EXISTS project_connections (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  target_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  label       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_project_connections_source ON project_connections(source_id);
CREATE INDEX IF NOT EXISTS idx_project_connections_target ON project_connections(target_id);
