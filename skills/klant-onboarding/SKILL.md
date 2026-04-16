---
name: klant-onboarding
description: >
  Gebruik deze skill wanneer Rick zegt "onboard nieuwe klant", "nieuwe klant toevoegen", "maak onboarding aan voor" of vergelijkbare varianten — ook als er een naam, type bedrijf of locatie bij staat. De skill leest de projectbestanden, genereert een gepersonaliseerde pitch email, een config-voorstel en een onboarding checklist, en slaat alles op in klanten/[naam]/. Activeer altijd als er een klantnaam + bedrijfstype wordt genoemd in de context van het MKB chatbot platform.
---

# Klant-onboarding skill

Wanneer Rick een nieuwe klant wil onboarden, genereer je drie bestanden op basis van de klantgegevens en de bestaande projecttemplates.

## Trigger

Voorbeelden van gebruikersprompts die deze skill activeren:
- "onboard nieuwe klant Harun kapper Alblasserdam"
- "nieuwe klant toevoegen: Lisa, restaurant, Rotterdam"
- "maak onboarding aan voor sportschool FitPlus in Utrecht"
- "onboard klant [naam] [type] [locatie]"

## Stap 1 — Gegevens ophalen

Lees als eerste de volgende bestanden uit de projectmap:

1. `PRODUCT.md` — voor pakketten, modules en prijzen
2. `PITCH-EMAIL.md` — als template voor de gepersonaliseerde email

De projectmap is de geselecteerde werkmap (de map die als workspace is gekoppeld). Gebruik de `Read` tool op deze paden relatief aan de workspace root.

Haal uit de gebruikersprompt:
- **naam** — voornaam of bedrijfsnaam van de klant
- **type** — type bedrijf (kapper, café, restaurant, sportschool, salon, webshop, etc.)
- **locatie** — stad of regio (optioneel, gebruik "Nederland" als niet opgegeven)

## Stap 2 — Map aanmaken

Maak de map `klanten/[naam]/` aan in de workspace root. Gebruik de naam in lowercase, spaties vervangen door koppeltekens (bijv. "Harun" → `klanten/harun/`).

## Stap 3 — Drie bestanden genereren

### Bestand 1: `pitch-[naam].md`

Een persoonlijke pitch email gebaseerd op `PITCH-EMAIL.md`. Pas aan:
- Begroeting met voornaam
- Tweede alinea: noem een concreet voorbeeld dat past bij het type bedrijf
  - kapper/barbershop/salon → afspraken inplannen, minder no-shows
  - horeca/café/restaurant → bestellingen opnemen, vragen beantwoorden
  - sportschool/fitness → ledenadministratie, vragen over roosters
  - winkel/webshop → productinfo, openingstijden, retourvragen
  - dienstverlener (generiek) → klantvragen automatiseren, bereikbaarheid
- Locatie verwerken als dat relevant voelt (bijv. "in [stad]")
- Ondertekening altijd: Rick Sieders, Brickerts, ricksieders@gmail.com, chatrick.nl

Houd het op max 10 zinnen. Direct, geen jargon.

### Bestand 2: `config-voorstel.md`

Een voorstel voor welke modules relevant zijn voor dit type bedrijf, met prijsindicatie uit `PRODUCT.md`. Structuur:

```
# Config-voorstel — [naam] ([type], [locatie])

## Aanbevolen modules

[Per module: naam, waarom relevant voor dit type, prijs range]

## Aanbevolen pakket

[Starter / Groei / Compleet] — waarom dit pakket het beste past

## Investering

Setup: €[range]
Maandelijks: €[range]/mnd
Terugverdientijd: [schatting op basis van type bedrijf]

## Optionele uitbreidingen later

[Modules die nu nog niet nodig zijn maar later interessant kunnen worden]
```

Richtlijnen per type:
- **Kapper / barbershop / salon**: Prioriteit → AI Chatbot + Afspraken, Lead Reactivation. Kennisbank en rapportages zijn nice-to-have.
- **Horeca / café / restaurant**: Prioriteit → AI Chatbot + Bestellingen, Kennisbank (menu), Rapportages. Afspraken minder relevant.
- **Sportschool / fitness**: Prioriteit → AI Chatbot + Afspraken, Kennisbank (rooster/regels), Lead Reactivation.
- **Winkel / webshop**: Prioriteit → AI Chatbot, Kennisbank (producten/retour), Document Scanner (facturen).
- **Dienstverlener (generiek)**: Prioriteit → AI Chatbot, Kennisbank, Afspraken. Pas aan op context.

### Bestand 3: `onboarding-checklist.md`

Een praktische checklist om deze klant live te krijgen. Structuur:

```
# Onboarding checklist — [naam]

## Fase 1: Voorbereiding (voor het gesprek)
- [ ] Kennismakingsgesprek inplannen
- [ ] Website van klant bekijken
- [ ] Noteer: welke vragen krijgen ze vaak? Wat zijn hun openingstijden?
- [ ] Config JSON opstellen op basis van config-voorstel.md

## Fase 2: Setup (na akkoord)
- [ ] Config JSON aanmaken in configs/[naam].json
- [ ] CONFIG_MAP bijwerken in vraag-claude.js en get-config.js
- [ ] System prompt testen: stel 5 testvragen die klanten zouden stellen
- [ ] [type-specifiek: bijv. "plan_afspraak tool activeren" voor kapper]
- [ ] Supabase: controleer of RLS juist is ingesteld
- [ ] Chatbot embedden op website klant (snippet aanleveren)

## Fase 3: Livegang
- [ ] Samen doorlopen met klant: hoe werkt het dashboard?
- [ ] Testgesprek voeren via de chatbot
- [ ] Netlify deploy uitvoeren
- [ ] Live URL doorgeven aan klant

## Fase 4: Nazorg (eerste maand)
- [ ] Na 1 week: check api_usage — binnen budget?
- [ ] Na 2 weken: klant bellen — werkt alles naar wens?
- [ ] Na 1 maand: eerste rapport genereren en opsturen
- [ ] Factuur sturen voor maandelijks abonnement
```

Voeg type-specifieke stappen toe waar relevant (bijv. voor kapper: afspraken koppelen aan kalender, voor horeca: menu uploaden naar kennisbank).

## Stap 4 — Bevestiging

Geef na het aanmaken een kort overzicht:

> "Klaar! Ik heb `klanten/[naam]/` aangemaakt met:
> - `pitch-[naam].md` — gepersonaliseerde email klaar om te sturen
> - `config-voorstel.md` — [aanbevolen pakket] met setup €X + €Y/mnd
> - `onboarding-checklist.md` — [N] stappen om live te gaan
>
> Wil je ook direct een config JSON aanmaken voor [naam]?"

---

## Voorbeeldoutput

**Input:** `onboard nieuwe klant Harun kapper Alblasserdam`

**Gegenereerde bestanden:**
- `klanten/harun/pitch-harun.md`
- `klanten/harun/config-voorstel.md`
- `klanten/harun/onboarding-checklist.md`

**Input:** `nieuwe klant toevoegen: Zara's Beauty, salon, Den Haag`

**Gegenereerde bestanden:**
- `klanten/zaras-beauty/pitch-zaras-beauty.md`
- `klanten/zaras-beauty/config-voorstel.md`
- `klanten/zaras-beauty/onboarding-checklist.md`
