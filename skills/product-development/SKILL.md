---
name: product-development
description: >
  Gebruik deze skill wanneer Rick een nieuw product of project wil plannen en bouwen. Triggers: "nieuw product [naam]", "bouw [naam]", "plan product [naam]", "start project [naam]", of elke variant waarbij een productnaam of projectidee wordt genoemd in combinatie met bouwen, plannen of starten. De skill leidt Rick door een volledig product-development proces: van idee-analyse via PRD en architectuurbeslissingen naar een bouwklaar plan. Activeer ook wanneer Rick zegt "ik wil iets bouwen" of "ik heb een idee voor [iets]" — zelfs zonder het woord "product" of "project".
---

# Product-development skill

Wanneer Rick een nieuw product of project wil plannen, doorloop je samen een gestructureerd 5-stappen proces dat eindigt in drie kant-en-klare bestanden: een PRD, een CLAUDE.md en een BUILDPLAN. Het doel is dat Rick daarna direct aan de slag kan — of zelf, of door de bestanden aan Claude Code te geven.

De vaste stack is: Netlify Functions (CJS), Claude API (Haiku/Sonnet/Opus), Supabase, vanilla HTML/JS. Houd hier altijd rekening mee in je aanbevelingen.

---

## Stap 1 — Analyse: stel gerichte vragen

Stel Rick 3 tot 5 vragen om het product goed te begrijpen. Doe dit in één bericht, genummerd. Wacht op zijn antwoorden voordat je verder gaat.

Goede vragen zijn:
1. **Wat doet het?** — Beschrijf het product in één zin. Wat is de kern?
2. **Voor wie?** — Wie gebruikt het, en in welke context? (Eindklant, Rick zelf, bedrijfseigenaar, etc.)
3. **Welk probleem lost het op?** — Wat is er nu omslachtig, traag of kapot dat dit oplost?
4. **Wat heeft het nodig?** — Welke data, integraties of externe diensten zijn relevant? (bijv. Supabase tabellen, bestaande functions, externe APIs)
5. **Scope?** — Wil je snel een werkende MVP of een volledig uitgewerkte versie?

Pas de vragen aan op basis van wat al bekend is uit de triggerprompt. Als Rick "bouw een facturatietool voor kappers" zegt, weet je al wat het is en voor wie — dan kun je die vragen overslaan en dieper gaan op scope en integraties.

---

## Stap 2 — PRD genereren

Maak op basis van de antwoorden een `PRD.md` aan. Dit document legt vast wat er gebouwd wordt en waarom — niet hoe. Het is de bron van waarheid voor alle verdere beslissingen.

```
# PRD — [Productnaam]

## Probleemstelling
[Wat is het probleem, voor wie, waarom is het nu niet opgelost?]

## Oplossing
[Eén alinea: wat bouw je, hoe lost het het probleem op]

## Doelgroep
[Wie gebruikt het, in welke situatie]

## User stories
- Als [rol] wil ik [actie] zodat [waarde]
- (3-6 user stories)

## Features

### Must have (MVP)
- [Feature 1]
- [Feature 2]

### Should have (later)
- [Feature 3]

### Won't have (buiten scope)
- [Feature X] — bewuste keuze omdat [reden]

## Technische stack
- Backend: Netlify Functions (CJS), Node.js
- AI: Claude API ([model] — kies op basis van complexiteit en kosten)
- Database: Supabase ([welke tabellen zijn nodig])
- Frontend: Vanilla HTML/JS, donker thema

## Datamodel
[Per tabel: naam, kolommen, relaties, RLS aan/uit en waarom]
```

Wees concreet en bondig. Een PRD hoeft niet lang te zijn — het moet helder zijn.

---

## Stap 3 — CLAUDE.md genereren

Maak een `CLAUDE.md` aan die projectcontext en bouwregels vastlegt. Dit bestand is bedoeld voor Claude Code (of een nieuwe Claude-sessie) zodat die het project direct begrijpt zonder uitleg.

```
# [Productnaam]

## Project
[Één zin wat het product doet en voor wie]

## Stack
- Netlify Functions (CJS, exports.handler)
- Claude API ([model] voor [doel])
- Supabase ([project-id of placeholder])
- Vanilla HTML/JS frontend, donker thema

## Architectuur

### Netlify Functions (netlify/functions/)
[Per function: naam.js — wat het doet]

### Pagina's
[Lijst van HTML-pagina's en hun doel]

### Supabase tabellen
[Per tabel: naam, RLS-status, kolommen]

## Bouwvolgorde
1. [Eerste wat gebouwd moet worden]
2. [Daarna]
3. [etc.]

## Architectuurregels
- Altijd CJS (geen ESM) — streaming werkt niet met Netlify Dev
- Configs via require() in CONFIG_MAP — geen fs.readFileSync in productie
- Alle functions gebruiken _utils.js: ok/fail/parseBody/requireFields/asyncHandler/withTimeout/logUsage
- Nieuwe functie = altijd asyncHandler wrapper
- Commit messages in het Nederlands

## Deploy
- `netlify deploy --prod` vanuit projectroot
- Env vars: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
```

Pas de secties aan op het specifieke product. Laat lege of niet-relevante secties weg.

---

## Stap 4 — BUILDPLAN.md genereren

Maak een `BUILDPLAN.md` aan met genummerde bouwstappen die rechtstreeks als instructieset gebruikt kunnen worden. Elke stap is klein genoeg om in één sessie te voltooien.

```
# BUILDPLAN — [Productnaam]

## Uitgangspunt
[Korte beschrijving van de startpositie: nieuw project of uitbreiding op bestaand project]

## Stap 1 — [Naam]
**Wat:** [Wat wordt er in deze stap gebouwd]
**Bestanden aanmaken:**
- `netlify/functions/naam.js` — [wat het doet]
- `pagina.html` — [wat het doet]
**Bestanden wijzigen:**
- `netlify/functions/_utils.js` — [wat er aan toe te voegen]
**Acceptatiecriteria:**
- [ ] [Wat moet werken om deze stap als klaar te beschouwen]
- [ ] [Testgeval]

## Stap 2 — [Naam]
...
```

Orden de stappen zodat elke stap bouwt op de vorige: begin altijd met de Supabase tabelstructuur en _utils.js, dan de core backend function, dan de frontend, dan optionele features.

---

## Stap 5 — Bevestiging

Geef een overzicht van de drie bestanden voordat je ze opslaat:

> **Klaar om op te slaan in `[productnaam]/`:**
>
> 📄 **PRD.md** — [één zin samenvatting van scope]
> 📄 **CLAUDE.md** — [X functions, Y pagina's, Z Supabase tabellen]
> 📄 **BUILDPLAN.md** — [N stappen, geschatte doorlooptijd]
>
> Wil je aanpassingen, of kan ik de bestanden opslaan?

Wacht op zijn bevestiging. Sla daarna alle drie de bestanden op in een map `producten/[productnaam]/` in de workspace root. Gebruik de productnaam in lowercase met koppeltekens.

---

## Voorbeelden

**Trigger:** "nieuw product facturatie-tool"
→ Stap 1: vraag wie het gebruikt, welke data, scope
→ Stap 2–4: genereer PRD/CLAUDE.md/BUILDPLAN voor facturatie-module
→ Sla op in `producten/facturatie-tool/`

**Trigger:** "bouw een review-widget voor de kapper-klanten"
→ Herken: uitbreiding op bestaand MKB-platform, klantgerichte widget
→ Stap 1: vraag welke klanten, hoe reviews worden opgeslagen, tonen op website?
→ Sla op in `producten/review-widget/`

**Trigger:** "start project dashboard voor Rick zelf"
→ Herken: interne tool, geen klantconfiguratie nodig
→ Stap 1: vraag wat het dashboard toont, welke databronnen
→ Sla op in `producten/intern-dashboard/`
