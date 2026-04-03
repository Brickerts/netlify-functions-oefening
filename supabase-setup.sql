-- Maak de bestellingen tabel aan
CREATE TABLE IF NOT EXISTS bestellingen (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  klant       TEXT NOT NULL,
  items       JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index op klant voor snelle filtering
CREATE INDEX IF NOT EXISTS bestellingen_klant_idx ON bestellingen (klant);

-- Index op created_at voor gesorteerde queries
CREATE INDEX IF NOT EXISTS bestellingen_created_at_idx ON bestellingen (created_at DESC);

-- Row Level Security inschakelen
ALTER TABLE bestellingen ENABLE ROW LEVEL SECURITY;

-- Anon mag inserten (chatbot plaatst bestellingen zonder authenticatie)
CREATE POLICY "anon_insert" ON bestellingen
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated users mogen alles lezen
CREATE POLICY "authenticated_select" ON bestellingen
  FOR SELECT
  TO authenticated
  USING (true);

-- Anon mag ook lezen (voor het dashboard zonder login)
-- Verwijder deze policy als je het dashboard wilt beveiligen
CREATE POLICY "anon_select" ON bestellingen
  FOR SELECT
  TO anon
  USING (true);
