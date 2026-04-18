# Beslissingen

## Architectuur
- **CJS over ESM** — Netlify Dev heeft problemen met streaming + ESM. Alle functions blijven CommonJS.
- **CONFIG_MAP via require()** — `fs.readFileSync` werkt niet in Netlify productie. Configs worden gebundeld via `require()` in een `CONFIG_MAP` object.
- **_utils.js** — gedeelde helpers voor alle functions. Alles wat herhaald wordt (ok/fail/asyncHandler/logUsage/checkRateLimit) zit hier.
- **Fail-open logging** — `logUsage` en `checkRateLimit` gooien nooit errors. Ze loggen stil en laten de hoofdflow doorgaan.
- **dotenv override: true** — lokale .env overschrijft Netlify dashboard vars tijdens development.

## Database
- **Supabase project:** zkrsbyxmyedtnyhhmpyx
- **api_usage RLS:** service_role only — geen publieke toegang
- **afspraken tabel:** nog UNRESTRICTED — RLS hardening staat op de TODO lijst

## Pricing (Claude API, vastgesteld april 2026)
- Opus 4.6: $5 input / $25 output per 1M tokens
- Haiku 4.5: $1 input / $5 output per 1M tokens

## Tooling
- **plan_afspraak tool:** gebruikt nu `diensten` array (was `dienst` string) — meerdere diensten per afspraak mogelijk
- **Subagents geblokkeerd voor MCP** — Supabase queries altijd in hoofdgesprek doen
