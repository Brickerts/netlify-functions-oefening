const { createClient } = require('@supabase/supabase-js')

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
  contact: 'contactformulier invullen'
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

  const contextBlok = contextChunks?.length
    ? `\nRelevante bedrijfsinformatie:\n${contextChunks.map(c => `---\n${c.content}`).join('\n')}\n---\nBaseer je antwoord op de verstrekte bedrijfsinformatie. Als de informatie het antwoord niet bevat, zeg dat je het niet weet.\n`
    : ''

  return `Je bent een vriendelijke assistent voor ${config.bedrijfsnaam}, een ${config.type} bedrijf. ${config.beschrijving} Je helpt klanten met vragen en bestellingen. Spreek altijd Nederlands.

Dit zijn de EXACTE openingstijden, gebruik deze letterlijk en verzin nooit andere tijden:
${tijden}

Noem ALLEEN de volgende diensten, verzin nooit andere diensten:
${diensten}
${uitgeschakeldBlok}${contextBlok}`
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
  return tools
}

const API_URL = 'https://api.anthropic.com/v1/messages'

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  }
}

// Haalt RAG-context op via Supabase full-text search.
// Geeft lege array terug bij elke fout zodat de chatbot gewoon door kan.
async function haalContext(klant, vraag) {
  try {
    if (!process.env.SUPABASE_URL) return []

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    const { data } = await supabase.rpc('zoek_documenten', {
      zoek_query: vraag,
      klant_naam: klant,
      aantal:     5
    })

    return data || []
  } catch {
    return []
  }
}

exports.handler = async (event) => {
  try {
    const { geschiedenis, klant } = JSON.parse(event.body)

    const config = laadConfig(klant)
    if (!config) {
      return {
        statusCode: 400,
        body: JSON.stringify({ fout: `Onbekende klant: ${klant}` })
      }
    }

    // Haal RAG-context op op basis van de laatste user-vraag
    const laasteVraag = [...geschiedenis].reverse().find(m => m.role === 'user')?.content || ''
    const contextChunks = await haalContext(config.bedrijfsnaam, laasteVraag)

    const tools = bouwTools(config)

    const requestBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: bouwSystemPrompt(config, contextChunks),
      messages: geschiedenis,
      ...(tools.length > 0 ? { tools } : {})
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (!data.content) {
      return {
        statusCode: 500,
        body: JSON.stringify({ fout: data.error?.message })
      }
    }

    const toolBlock = data.content.find(b => b.type === 'tool_use')

    if (toolBlock?.name === 'plaas_bestelling') {
      const { items, aantal } = toolBlock.input
      const omschrijving = items.map((item, i) => `${aantal[i]}x ${item}`).join(', ')

      // Sla bestelling op in Supabase (fire-and-forget, fout blokkeert niet)
      fetch(`${process.env.URL}/.netlify/functions/sla-bestelling-op`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klant: config.bedrijfsnaam, items, aantal })
      }).catch(() => {})

      const res2 = await fetch(API_URL, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: bouwSystemPrompt(config, contextChunks),
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
      })

      const data2 = await res2.json()
      const tekst = data2.content?.find(b => b.type === 'text')?.text || 'Bestelling verwerkt.'
      return {
        statusCode: 200,
        body: JSON.stringify({ antwoord: tekst, bestelling: { items, aantal } })
      }
    }

    const tekst = data.content.find(b => b.type === 'text')?.text || ''
    return {
      statusCode: 200,
      body: JSON.stringify({ antwoord: tekst })
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ fout: err.message })
    }
  }
}
