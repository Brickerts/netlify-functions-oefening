# MKB Chatbot Platform — Project Overzicht

> White-label AI chatbot platform voor MKB. Eén codebase, meerdere klanten via config JSON bestanden.
> Live URL: [mkb-chatbot.netlify.app](https://mkb-chatbot.netlify.app) _(momenteel gepauzeerd — billing reset 17 april)_

---

## Stack

| Laag | Technologie |
|------|-------------|
| Hosting / Functions | Netlify (CJS, `exports.handler`) |
| AI | Claude API — Haiku (chat), Opus (document scanning) |
| Database | Supabase (project: `zkrsbyxmyedtnyhhmpyx`) |
| Frontend | Vanilla HTML/JS, donker thema |

---

## Klant-configuraties (`configs/`)

Elke klant heeft een JSON bestand met bedrijfsnaam, type, openingstijden, beschikbare diensten en welke tools actief zijn.

### `demo.json` — Demo Café
- **Type:** horeca
- **Diensten:** koffie, lunch, diner, afhaal
- **Openingstijden:** ma-vr 08:00-18:00, za-zo 09:00-17:00
- **Tools:** bestelling ✅ · reservering ❌ · contact ✅
- **Limiet:** 1000 calls/maand, max €5/maand

### `kapper.json` — Stijlvol (Alblasserdam)
- **Type:** dienstverlening
- **Diensten:** knippen heren/dames/kinderen, baard trimmen
- **Openingstijden:** di-vr 09:00-18:00, za 09:00-16:00, zo-ma gesloten
- **Tools:** bestelling ❌ · reservering ❌ · contact ✅ · afspraak ✅
- **Limiet:** 1000 calls/maand, max €5/maand

> **Nieuwe klant toevoegen:** JSON aanmaken in `configs/` + toevoegen aan `CONFIG_MAP` in `vraag-claude.js` en `get-config.js`. Of gebruik het slash command `/klant-toevoegen [naam]`.

---

## Netlify Functions (`netlify/functions/`)

### Kernfuncties

| Bestand | Doel |
|---------|------|
| `vraag-claude.js` | Hoofdchatbot — dynamische system prompt, tool use, Supabase opslag, rate limiting |
| `get-config.js` | Publiek config endpoint — geeft klantconfig terug op basis van `?klant=` parameter |
| `scan-document.js` | PDF/afbeelding scanner met Claude Vision (Opus model) |

### Bestellingen

| Bestand | Doel |
|---------|------|
| `sla-bestelling-op.js` | POST — nieuwe bestelling opslaan in Supabase |
| `haal-bestellingen-op.js` | GET — bestellingen ophalen, optioneel gefilterd op klant |

### Documenten & RAG (Kennisbank)

| Bestand | Doel |
|---------|------|
| `upload-document.js` | Documenten chunken (500 woorden, 50 overlap) en opslaan voor RAG |
| `beheer-documenten.js` | GET/DELETE — documenten beheer (lijst & verwijderen) |
| `zoek-context.js` | POST — full-text search in kennisbank voor RAG context |
| `debug-rag.js` | Debug endpoint — stap-voor-stap RAG pipeline diagnostiek |

### Leads & Reactivatie

| Bestand | Doel |
|---------|------|
| `beheer-leads.js` | GET/POST/PATCH — leads CRUD met statustracking |
| `genereer-reactivatie.js` | POST — AI-gegenereerd persoonlijk reactivatiebericht (Claude Haiku) |

### Afspraken

| Bestand | Doel |
|---------|------|
| `beheer-afspraken.js` | GET/POST/PATCH/DELETE — afspraken CRUD (klant, naam, telefoon, dienst, datum, tijd, status) |

### Rapportage & Kosten

| Bestand | Doel |
|---------|------|
| `generate-report.js` | POST — AI rapport generatie op basis van bestellingen (periode instelbaar) |
| `kosten-stats.js` | GET — Claude API kostenstatistieken per klant en functie |

### Utilities & Test

| Bestand | Doel |
|---------|------|
| `_utils.js` | Gedeelde helpers: `ok/fail/parseBody/requireFields/asyncHandler/withTimeout/logUsage/berekenKosten/PRIJZEN` |
| `hallo.js` | Simpele testfunction — health check |

---

## HTML Pagina's

| Pagina | Titel | Doel |
|--------|-------|------|
| `index.html` | Chatbot | Chat interface — laadt config op basis van `?klant=` param |
| `scanner.html` | Document Scanner | Upload PDF/afbeelding → Claude Vision analyse |
| `dashboard.html` | Bestellingen Dashboard | Bestellingen inzien, filteren op klant |
| `kennisbank.html` | Kennisbank | RAG documenten uploaden en beheren |
| `leads.html` | Lead Reactivatie | Leads beheren, reactivatieberichten genereren |
| `report-dashboard.html` | Rapport Dashboard | AI-rapporten genereren op basis van bestellingen |
| `afspraken-dashboard.html` | Afspraken Dashboard | Afspraken inzien en beheren |
| `kosten-dashboard.html` | Kosten Dashboard | Claude API kosten per klant en functie monitoren |

---

## Supabase Tabellen

| Tabel | RLS | Inhoud |
|-------|-----|--------|
| `bestellingen` | ✅ aan | Bestellingen via tool use — klant, items, aantal |
| `documenten` | ✅ aan | RAG kennisbank — chunks met full-text search (`zoek_vector`) |
| `leads` | ✅ aan | Lead reactivation — naam, klant, notities, status |
| `afspraken` | ⚠️ open | Klant, naam_klant, telefoon, dienst, datum, tijd, status |
| `api_usage` | ⚠️ open | Claude API gebruik — klant, function_naam, model, tokens, kosten_eur |

> **TODO:** RLS hardening voor `afspraken` en `api_usage`.

SQL setup scripts: `supabase-setup.sql`, `supabase-rag-setup.sql`, `supabase-leads-setup.sql`

---

## Slash Commands

| Command | Actie |
|---------|-------|
| `/rapport` | Zakelijk rapport van bestellingen afgelopen 7 dagen |
| `/status` | Compact overzicht: bestellingen, leads, documenten per klant |
| `/klant-toevoegen [naam]` | Complete klant-setup: config JSON + CONFIG_MAP updates |
| `/weekly-review` | Volledige weekly business review met analyse en actiepunten |

---

## Architectuurregels

- **Altijd CJS** (geen ESM) — streaming werkt niet met Netlify Dev
- **Configs via `require()`** in `CONFIG_MAP` — `fs.readFileSync` werkt niet in productie
- **System prompt** bevat exacte openingstijden + diensten uit config; uitgeschakelde tools expliciet verbieden
- **`afspraak: true`** in config → activeert `plan_afspraak` tool in `vraag-claude.js`
- **Commit messages** in het Nederlands
- **Subagents** kunnen geen Supabase MCP tools gebruiken — altijd hoofdgesprek gebruiken voor data queries

---

## Deploy

```bash
netlify deploy --prod
```

**Environment variables op Netlify:**
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

---

_Gegenereerd op 12 april 2026_
