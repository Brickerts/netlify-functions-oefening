# MKB AI Platform — Brickerts

White-label AI-platform waarmee MKB-bedrijven hun klantenservice, administratie en rapportage automatiseren. Gebouwd op Netlify Functions en de Claude API van Anthropic. Eén codebase, meerdere klanten via per-klant configuratie.

**Live demo:** [mkb-chatbot.netlify.app](https://mkb-chatbot.netlify.app)

---

## Modules

### AI Chatbot
Slimme chatbot op maat per klant. Beantwoordt vragen, neemt bestellingen op en plant afspraken in via Claude tool use. Volledig configureerbaar: openingstijden, diensten, taalgebruik en beschikbare tools worden per klant ingesteld via een JSON config.

### Document Scanner
Upload een factuur, bon of contract — de AI (Claude Vision / Opus) extraheert automatisch alle relevante data: bedrijfsnaam, datum, bedragen, BTW, IBAN. Geeft gestructureerde JSON terug.

### Kennisbank (RAG)
Chatbot beantwoordt vragen op basis van eigen bedrijfsdocumenten via full-text search op Supabase. Automatische fallback naar meest recente documenten als full-text search geen resultaat geeft.

### Lead Reactivation
Identificeert slapende klanten (30+ dagen inactief) en genereert gepersonaliseerde reactivatieberichten via de Claude API. Berichten zijn afgestemd op naam, laatste bezoek en bedrijfstype.

### Rapportages & Dashboard
AI-gegenereerde zakelijke rapportages op basis van bestellingsdata. Keuze uit dagelijks, wekelijks, maandelijks of aangepaste periode. Visualisaties met piekuren en populairste producten.

### Kosten Dashboard
Realtime inzicht in Claude API-gebruik per klant en per functie. Automatische kostenberekening in EUR op basis van actuele Anthropic-tarieven. Maandelijkse limieten instelbaar per klant via config — bij overschrijding wordt de chatbot vriendelijk geblokkeerd.

---

## Tech Stack

| Laag | Technologie |
|---|---|
| Backend | Netlify Functions (Node.js, CJS) |
| AI | Claude API — Haiku 4.5 (chat), Opus 4.6 (scanner) |
| Database | Supabase (PostgreSQL, RLS, full-text search) |
| Frontend | Vanilla HTML/JS, donker thema |
| Lokale dev | netlify dev, dotenv |

---

## Architectuur

```
configs/
  demo.json         ← per-klant config (bedrijfsnaam, diensten, tools, limieten)
  kapper.json

netlify/functions/
  _utils.js         ← gedeelde helpers (ok, fail, asyncHandler, logUsage, checkRateLimit, ...)
  vraag-claude.js   ← chatbot core, tool use, RAG, rate limiting
  beheer-afspraken.js
  beheer-documenten.js
  beheer-leads.js
  kosten-stats.js
  generate-report.js
  genereer-reactivatie.js
  scan-document.js
  upload-document.js
  zoek-context.js
  ...

*.html              ← dashboards en chat UI per module
```

**CONFIG_MAP pattern:** elke functie laadt klant-configs via `require()` in een `CONFIG_MAP` object. Dit garandeert dat configs gebundeld worden bij deployment — `fs.readFileSync` werkt niet in Netlify productie.

**`_utils.js`:** gedeelde utilities voor alle functions — response helpers (`ok`, `fail`), request parsing (`parseBody`, `requireFields`), error handling (`asyncHandler`), Claude API kostenberekening (`berekenKosten`, `logUsage`) en rate limiting (`checkRateLimit`).

---

## Supabase tabellen

| Tabel | Beschrijving | RLS |
|---|---|---|
| bestellingen | Bestellingen via chatbot tool use | Aan |
| documenten | RAG kennisbank met full-text search | Aan |
| leads | Lead reactivation met statustracking | Aan |
| afspraken | Afspraken via plan_afspraak tool | TODO |
| api_usage | Claude API kosten per call | TODO |

---

## Lokaal draaien

```bash
# 1. Clone de repo
git clone https://github.com/Brickerts/netlify-functions-oefening.git
cd netlify-functions-oefening

# 2. Installeer dependencies
npm install

# 3. Maak .env aan
cp .env.example .env
# Vul in: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY

# 4. Start lokale dev server
netlify dev

# 5. Open in browser
# http://localhost:8888
```

---

## Screenshots

> *(volgt)*

| Chatbot | Afspraken Dashboard | Kosten Dashboard |
|---|---|---|
| `screenshot-chat.png` | `screenshot-afspraken.png` | `screenshot-kosten.png` |

---

## Contact

**Rick Sieders — Brickerts**
Website: [chatrick.nl](https://chatrick.nl) *(coming soon)*
GitHub: [github.com/Brickerts](https://github.com/Brickerts)
Email: ricksieders@gmail.com
