-- Maak de leads tabel aan
CREATE TABLE IF NOT EXISTS leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  klant            TEXT NOT NULL,
  naam             TEXT NOT NULL,
  email            TEXT,
  telefoon         TEXT,
  laatste_bezoek   DATE,
  totaal_bezoeken  INTEGER DEFAULT 0,
  notities         TEXT,
  status           TEXT NOT NULL DEFAULT 'actief' CHECK (status IN ('actief', 'inactief', 'heractiveerd')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS leads_klant_idx          ON leads (klant);
CREATE INDEX IF NOT EXISTS leads_laatste_bezoek_idx ON leads (laatste_bezoek ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS leads_status_idx         ON leads (status);

-- Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON leads
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_all" ON leads
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
