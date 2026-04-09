# MKB Chatbot Platform

## Project
White-label AI chatbot platform voor MKB. Eén codebase, meerdere klanten via config JSON bestanden.

## Stack
- Netlify Functions (CJS, exports.handler)
- Claude API (Haiku voor chat, Opus voor document scanning)
- Supabase (bestellingen, documenten/RAG, RLS)
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
- generate-report.js — AI rapport generatie op basis van bestellingen
- debug-rag.js — RAG debugging hulp
- hallo.js — test function

### Pagina's
index.html (chat), scanner.html, dashboard.html, kennisbank.html, leads.html, report-dashboard.html

### Supabase tabellen
- bestellingen — bestellingen via tool use
- documenten — RAG kennisbank (full-text search, zoek_vector)
- leads — lead reactivation met status tracking

### MCP
- Supabase MCP gekoppeld via https://mcp.supabase.com/mcp

### Slash commands
- /rapport — genereer zakelijk rapport van bestellingen afgelopen 7 dagen

## Regels
- Altijd CJS (geen ESM) — streaming werkt niet met Netlify Dev
- Configs bundelen via require() in CONFIG_MAP — fs.readFileSync werkt niet in productie
- Nieuwe klant = JSON in configs/ + toevoegen aan CONFIG_MAP in vraag-claude.js en get-config.js
- System prompt: exacte openingstijden + diensten uit config, uitgeschakelde tools expliciet verbieden
- Commit messages in het Nederlands

## Deploy
- netlify deploy --prod vanuit projectroot
- Env vars op Netlify: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
- Live URL: mkb-chatbot.netlify.app