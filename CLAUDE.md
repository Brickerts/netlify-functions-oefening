# Sessie geheugen

Lees aan het begin van elke sessie deze vier bestanden:
- memory/user.md — wie Rick is
- memory/people.md — klanten en contacten
- memory/decisions.md — technische en zakelijke beslissingen
- memory/preferences.md — hoe Rick wil samenwerken

Update de relevante bestanden zodra je iets nieuws leert over:
- Een nieuwe klant of contact → people.md
- Een architectuurbeslissing of afgesproken aanpak → decisions.md
- Een voorkeur of werkwijze die Rick aangeeft → preferences.md
- Persoonlijke info over Rick → user.md

Schrijf alleen wat niet al afleidbaar is uit de code of git history.

---

# MKB Chatbot Platform

## Project
White-label AI chatbot platform voor MKB. Eén codebase, meerdere klanten via config JSON bestanden.

## Stack
- Netlify Functions (CJS, exports.handler)
- Claude API (Haiku voor chat, Opus voor document scanning)
- Supabase (bestellingen, documenten/RAG, leads, afspraken, RLS)
- Vanilla HTML/JS frontend, donker thema

## Architectuur

### Configs
configs/ — per-klant JSON (bedrijfsnaam, diensten, openingstijden, tools)

### Netlify Functions
- vraag-claude.js — chatbot, dynamische system prompt, tool use, Supabase opslag
- get-config.js — publiek config endpoint, CONFIG_MAP via require()
- scan-document.js — PDF/afbeelding scanner met Claude Vision
- sla-bestelling-op.js / haal-bestellingen-op.js — bestellingen CRUD
- upload-document.js / beheer-documenten.js — RAG documenten beheer
- zoek-context.js — RAG full-text search voor kennisbank
- beheer-leads.js / genereer-reactivatie.js — lead reactivation
- beheer-afspraken.js — afspraken CRUD (GET/POST/PATCH/DELETE)
- generate-report.js — AI rapport generatie op basis van bestellingen
- _utils.js — gedeelde helpers: ok/fail/parseBody/requireFields/asyncHandler/withTimeout/logUsage/berekenKosten/PRIJZEN
- debug-rag.js — RAG debugging hulp
- hallo.js — test function

### Pagina's
index.html (chat), scanner.html, dashboard.html, kennisbank.html, leads.html, report-dashboard.html, afspraken-dashboard.html

### Supabase tabellen
Project: zkrsbyxmyedtnyhhmpyx

- bestellingen (RLS aan) — bestellingen via tool use
- documenten (RLS aan) — RAG kennisbank (full-text search, zoek_vector)
- leads (RLS aan) — lead reactivation met status tracking
- afspraken (UNRESTRICTED, hardening TODO) — afspraken via plan_afspraak tool (klant, naam_klant, telefoon, dienst, datum, tijd, status)
- api_usage (UNRESTRICTED, hardening TODO) — Claude API gebruik per call (klant, function_naam, model, tokens, kosten_eur)

### MCP
- Supabase MCP gekoppeld via https://mcp.supabase.com/mcp
- Subagents kunnen GEEN MCP tools gebruiken (permissie-beperking) — altijd hoofdgesprek gebruiken voor data queries

### Slash commands
- /rapport — zakelijk rapport van bestellingen afgelopen 7 dagen
- /status — compact overzicht: bestellingen, leads, documenten per klant
- /klant-toevoegen [naam] — complete klant-setup: config JSON + CONFIG_MAP updates
- /weekly-review — volledige weekly business review met analyse en actiepunten

## Regels
- Altijd CJS (geen ESM) — streaming werkt niet met Netlify Dev
- Configs bundelen via require() in CONFIG_MAP — fs.readFileSync werkt niet in productie
- Nieuwe klant = JSON in configs/ + toevoegen aan CONFIG_MAP in vraag-claude.js en get-config.js
- System prompt: exacte openingstijden + diensten uit config, uitgeschakelde tools expliciet verbieden
- kapper config heeft afspraak: true → activeert plan_afspraak tool in vraag-claude.js
- Commit messages in het Nederlands

## Deploy
- netlify deploy --prod vanuit projectroot
- Env vars op Netlify: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
- Live URL: mkb-chatbot.netlify.app (momenteel gepauzeerd — billing cycle reset 17 april)

## Cowork Skills

De volgende skills zijn beschikbaar in Claude Cowork voor niet-code taken:

### klant-onboarding
Trigger: "onboard nieuwe klant [naam] [type] [locatie]"
Genereert: klanten/[naam]/ met pitch email, config-voorstel, onboarding checklist
Leest: PRODUCT.md, PITCH-EMAIL.md

### product-development
Trigger: "nieuw product [naam]", "bouw [naam]", "plan product [naam]", "start project [naam]"
Genereert: producten/[naam]/ met PRD.md, CLAUDE.md, BUILDPLAN.md
Stelt eerst 3-5 vragen, genereert daarna alle bestanden

### Beschikbare pitch materialen
- PRODUCT.md — volledige productbeschrijving met modules en prijzen
- PITCH-EMAIL.md — email template voor klantbenadering
- ONE-PAGER.md — printbare samenvatting met pakketten
- CASE-STUDY.md — fictieve case study Café De Hoek
- PITCH-HARUN.md — gepersonaliseerde pitch Damdorp Barbershop