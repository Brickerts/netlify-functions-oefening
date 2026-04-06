-- Activeer pgvector extensie
CREATE EXTENSION IF NOT EXISTS vector;

-- Maak de documenten tabel aan
CREATE TABLE IF NOT EXISTS documenten (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  klant       TEXT NOT NULL,
  titel       TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(384),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS documenten_klant_idx ON documenten (klant);
CREATE INDEX IF NOT EXISTS documenten_embedding_idx
  ON documenten USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Row Level Security
ALTER TABLE documenten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON documenten
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_all" ON documenten
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Similarity search functie (cosinus-afstand, kleinere waarde = meer gelijkend)
CREATE OR REPLACE FUNCTION zoek_documenten(
  query_embedding vector(384),
  klant_naam      text,
  aantal          int DEFAULT 5
)
RETURNS TABLE(id uuid, titel text, content text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    titel,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM documenten
  WHERE klant = klant_naam
    AND embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT aantal;
$$;
