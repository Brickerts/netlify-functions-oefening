-- Maak de documenten tabel aan (geen pgvector nodig)
CREATE TABLE IF NOT EXISTS documenten (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  klant        TEXT NOT NULL,
  titel        TEXT NOT NULL,
  content      TEXT NOT NULL,
  zoek_vector  TSVECTOR,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIN index voor snelle full-text search
CREATE INDEX IF NOT EXISTS documenten_klant_idx       ON documenten (klant);
CREATE INDEX IF NOT EXISTS documenten_zoek_vector_idx ON documenten USING GIN (zoek_vector);

-- Trigger: vul zoek_vector automatisch bij insert en update
CREATE OR REPLACE FUNCTION documenten_zoek_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.zoek_vector :=
    setweight(to_tsvector('dutch', coalesce(NEW.titel, '')),   'A') ||
    setweight(to_tsvector('dutch', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documenten_zoek_trigger ON documenten;
CREATE TRIGGER documenten_zoek_trigger
  BEFORE INSERT OR UPDATE ON documenten
  FOR EACH ROW EXECUTE FUNCTION documenten_zoek_vector_update();

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

-- Full-text search functie met ts_rank
CREATE OR REPLACE FUNCTION zoek_documenten(
  zoek_query text,
  klant_naam text,
  aantal     int DEFAULT 5
)
RETURNS TABLE(id uuid, titel text, content text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    titel,
    content,
    ts_rank(zoek_vector, plainto_tsquery('dutch', zoek_query))::float AS similarity
  FROM documenten
  WHERE klant = klant_naam
    AND zoek_vector @@ plainto_tsquery('dutch', zoek_query)
  ORDER BY similarity DESC
  LIMIT aantal;
$$;
