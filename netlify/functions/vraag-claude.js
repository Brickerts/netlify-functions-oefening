require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: true });
const { createClient } = require('@supabase/supabase-js')
const { ok, fail, parseBody, requireFields, withTimeout, asyncHandler, logUsage, checkRateLimit } = require('./_utils')

const CONFIG_MAP = {
  demo:   require('../../configs/demo.json'),
  kapper: require('../../configs/kapper.json')
}

function laadConfig(klant) {
  const veiligNaam = (klant || 'demo').replace(/[^a-z0-9-_]/gi, '')
  return CONFIG_MAP[veiligNaam] || null
}

const TOOL_LABELS = {
  bestelling: 'bestellingen plaatsen',
  reservering: 'reserveringen maken',
  contact: 'contactformulier invullen',
  afspraak: 'afspraken inplannen'
}

function huidigeDatumTijd() {
  const nu = new Date()
  const dagen   = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
  const maanden = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
  const dag   = dagen[nu.getDay()]
  const maand = maanden[nu.getMonth()]
  const uur   = String(nu.getHours()).padStart(2, '0')
  const min   = String(nu.getMinutes()).padStart(2, '0')
  return `Vandaag is ${dag} ${nu.getDate()} ${maand} ${nu.getFullYear()}, ${uur}:${min}.`
}

function bouwSystemPrompt(config, contextChunks) {
  const tijden = Object.entries(config.openingstijden)
    .map(([dag, tijd]) => `  - ${dag}: ${tijd}`)
    .join('\n')

  const diensten = config.diensten
    .map(d => `  - ${d}`)
    .join('\n')

  const uitgeschakeld = Object.entries(config.tools)
    .filter(([, aan]) => !aan)
    .map(([tool]) => `  - ${TOOL_LABELS[tool] || tool}`)
    .join('\n')

  const uitgeschakeldBlok = uitgeschakeld
    ? `\nDe volgende functies zijn UITGESCHAKELD en mag je NOOIT aanbieden, ook niet als de klant erom vraagt:\n${uitgeschakeld}\nAls een klant vraagt naar een uitgeschakelde functie, zeg dan dat dit niet beschikbaar is via de chat.\n`
    : ''

  const afspraakBlok = config.afspraak_instructie
    ? `\n${config.afspraak_instructie}\n`
    : ''

  const contextBlok = contextChunks?.length
    ? `\nRelevante bedrijfsinformatie:\n${contextChunks.map(c => `---\n${c.content}`).join('\n')}\n---\nBaseer je antwoord op de verstrekte bedrijfsinformatie. Als de informatie het antwoord niet bevat, zeg dat je het niet weet.\n`
    : ''

  return `${huidigeDatumTijd()}

Je bent een vriendelijke assistent voor ${config.bedrijfsnaam}, een ${config.type} bedrijf. ${config.beschrijving} Je helpt klanten met vragen en bestellingen. Spreek altijd Nederlands.

Dit zijn de EXACTE openingstijden, gebruik deze letterlijk en verzin nooit andere tijden:
${tijden}

Noem ALLEEN de volgende diensten, verzin nooit andere diensten:
${diensten}
${uitgeschakeldBlok}${afspraakBlok}${contextBlok}`
}

function bouwTools(config) {
  const tools = []
  if (config.tools.bestelling) {
    tools.push({
      name: 'plaas_bestelling',
      description: 'Gebruik dit wanneer een klant iets wil bestellen. Extraheer de items en aantallen uit het gesprek.',
      input_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lijst van bestelde items'
          },
          aantal: {
            type: 'array',
            items: { type: 'number' },
            description: 'Aantal per item, in dezelfde volgorde als items'
          }
        },
        required: ['items', 'aantal']
      }
    })
  }
  if (config.tools.afspraak) {
    tools.push({
      name: 'plan_afspraak',
      description: 'Gebruik dit wanneer een klant een afspraak wil maken. Verzamel naam, telefoonnummer, gewenste diensten (één of meerdere), datum en tijd.',
      input_schema: {
        type: 'object',
        properties: {
          naam_klant: { type: 'string', description: 'Volledige naam van de klant' },
          telefoon:   { type: 'string', description: 'Telefoonnummer van de klant' },
          diensten:   {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Lijst van gewenste diensten, bijv. ["knippen heren", "baard trimmen"]'
          },
          datum:      { type: 'string', description: 'Datum in YYYY-MM-DD formaat' },
          tijd:       { type: 'string', description: 'Tijd in HH:MM formaat' }
        },
        required: ['naam_klant', 'diensten', 'datum', 'tijd']
      }
    })
  }
  return tools
}

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL   = 'claude-haiku-4-5-20251001'

function cachedSystem(config, contextChunks) {
  return [{ type: 'text', text: bouwSystemPrompt(config, contextChunks), cache_control: { type: 'ephemeral' } }]
}

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'prompt-caching-2024-07-31'
  }
}

// Haalt RAG-context op via Supabase full-text search.
// Fallback: als FTS geen resultaten geeft, haal de 3 meest recente documenten op.
// Geeft lege array terug bij configuratiefouten zodat de chatbot door kan.
async function haalContext(klant, vraag) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return []

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

  try {
    // Poging 1: full-text search via RPC
    const { data: ftsData, error: ftsError } = await sb.rpc('zoek_documenten', {
      zoek_query: vraag,
      klant_naam: klant,
      aantal:     5
    })

    if (ftsError) {
      console.error('[RAG] RPC fout:', ftsError.message)
    } else if (ftsData && ftsData.length > 0) {
      return ftsData
    }

    // Poging 2: geen FTS-match → meest recente 3 documenten als fallback
    const { data: recentData, error: recentError } = await sb
      .from('documenten')
      .select('id, titel, content')
      .eq('klant', klant)
      .order('created_at', { ascending: false })
      .limit(3)

    if (recentError) {
      console.error('[RAG] Fallback fout:', recentError.message)
      return []
    }

    return recentData || []
  } catch (err) {
    console.error('[RAG] Onverwachte fout:', err.message)
    return []
  }
}

exports.handler = asyncHandler(async (event) => {
  const body = parseBody(event)
  requireFields(body, ['geschiedenis', 'klant'])
  const { geschiedenis, klant } = body

  const config = laadConfig(klant)
  if (!config) return fail(`Onbekende klant: ${klant}`, 400)

  const limit = await checkRateLimit(klant, config.limieten)
  if (!limit.allowed) {
    return ok({
      antwoord: 'Sorry, ik heb mijn maandelijkse limiet bereikt. Neem contact op met de eigenaar van deze chatbot of probeer het volgende maand opnieuw.',
      rate_limited: true
    })
  }

  // Haal RAG-context op op basis van de laatste user-vraag
  const laasteVraag = [...geschiedenis].reverse().find(m => m.role === 'user')?.content || ''
  const contextChunks = await haalContext(config.bedrijfsnaam, laasteVraag)

  const tools = bouwTools(config)

  const requestBody = {
    model: MODEL,
    max_tokens: 500,
    system: cachedSystem(config, contextChunks),
    messages: geschiedenis,
    ...(tools.length > 0 ? { tools } : {})
  }

  const response = await withTimeout(fetch(API_URL, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(requestBody)
  }), 30000)

  const data = await response.json()
  if (!data.content) return fail(data.error?.message || 'Claude API fout')

  await logUsage({ klant, function_naam: 'vraag-claude', model: MODEL, usage: data.usage })

  const toolBlock = data.content.find(b => b.type === 'tool_use')

  if (toolBlock?.name === 'plan_afspraak') {
    const { naam_klant, telefoon, diensten, datum, tijd } = toolBlock.input
    const dienstOmschrijving = diensten.join(', ')

    fetch(`${process.env.URL}/.netlify/functions/beheer-afspraken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ klant, naam_klant, telefoon, dienst: dienstOmschrijving, datum, tijd })
    }).catch(() => {})

    const bevestiging = `Afspraak ingepland: ${naam_klant} voor ${dienstOmschrijving} op ${datum} om ${tijd}`

    const res2 = await withTimeout(fetch(API_URL, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: cachedSystem(config, contextChunks),
        tools,
        messages: [
          ...geschiedenis,
          { role: 'assistant', content: data.content },
          {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: bevestiging
            }]
          }
        ]
      })
    }), 30000)

    const data2 = await res2.json()
    await logUsage({ klant, function_naam: 'vraag-claude', model: MODEL, usage: data2.usage })
    const tekst = data2.content?.find(b => b.type === 'text')?.text || 'Afspraak ingepland.'
    return ok({ antwoord: tekst, afspraak: { naam_klant, telefoon, diensten, datum, tijd } })
  }

  if (toolBlock?.name === 'plaas_bestelling') {
    const { items, aantal } = toolBlock.input
    const omschrijving = items.map((item, i) => `${aantal[i]}x ${item}`).join(', ')

    // Sla bestelling op in Supabase (fire-and-forget, fout blokkeert niet)
    fetch(`${process.env.URL}/.netlify/functions/sla-bestelling-op`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ klant, items, aantal })
    }).catch(() => {})

    const res2 = await withTimeout(fetch(API_URL, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: cachedSystem(config, contextChunks),
        tools,
        messages: [
          ...geschiedenis,
          { role: 'assistant', content: data.content },
          {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: `Bestelling succesvol geplaatst: ${omschrijving}`
            }]
          }
        ]
      })
    }), 30000)

    const data2 = await res2.json()
    await logUsage({ klant, function_naam: 'vraag-claude', model: MODEL, usage: data2.usage })
    const tekst = data2.content?.find(b => b.type === 'text')?.text || 'Bestelling verwerkt.'
    return ok({ antwoord: tekst, bestelling: { items, aantal } })
  }

  const tekst = data.content.find(b => b.type === 'text')?.text || ''
  return ok({ antwoord: tekst })
})
