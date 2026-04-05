# MKB Chatbot Platform

## Project
White-label AI chatbot platform voor MKB. Eén codebase, meerdere klanten via config JSON bestanden.

## Stack
- Netlify Functions (CJS, exports.handler)
- Claude API (Haiku voor chat, Opus voor document scanning)
- Supabase (bestellingen opslag, RLS)
- Vanilla HTML/JS frontend, donker thema

## Architectuur
- configs/ — per-klant JSON (bedrijfsnaam, diensten, openingstijden, tools)
- vraag-claude.js — chatbot met dynamische system prompt, tool use (plaas_bestelling), Supabase opslag
- get-config.js — publiek config endpoint, CONFIG_MAP via require()
- scan-document.js — PDF/afbeelding scanner met Claude Vision
- sla-bestelling-op.js / haal-bestellingen-op.js — Supabase CRUD
- Pagina's: index.html (chat), scanner.html, dashboard.html, leads.html

## Regels
- Altijd CJS (geen ESM) — streaming werkt niet met Netlify Dev
- Configs bundelen via require() in CONFIG_MAP — fs.readFileSync werkt niet in productie
- Nieuwe klant toevoegen = JSON in configs/ + toevoegen aan CONFIG_MAP in vraag-claude.js en get-config.js
- System prompt: exacte openingstijden + diensten uit config, uitgeschakelde tools expliciet verbieden
- Commit messages in het Nederlands

## Deploy
- netlify deploy --prod vanuit projectroot
- Env vars op Netlify: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
- Live URL: mkb-chatbot.netlify.app
