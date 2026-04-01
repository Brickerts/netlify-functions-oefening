const fs = require('fs')
const path = require('path')

function laadConfig(klant) {
  const veiligNaam = (klant || 'demo').replace(/[^a-z0-9-_]/gi, '')
  const bestandspad = path.resolve(__dirname, `../../configs/${veiligNaam}.json`)
  if (!fs.existsSync(bestandspad)) {
    return null
  }
  return JSON.parse(fs.readFileSync(bestandspad, 'utf8'))
}

const TOOL_LABELS = {
  bestelling: 'bestellingen plaatsen',
  reservering: 'reserveringen maken',
  contact: 'contactformulier invullen'
}

function bouwSystemPrompt(config) {
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

  return `Je bent een vriendelijke assistent voor ${config.bedrijfsnaam}, een ${config.type} bedrijf. ${config.beschrijving} Je helpt klanten met vragen en bestellingen. Spreek altijd Nederlands.

Dit zijn de EXACTE openingstijden, gebruik deze letterlijk en verzin nooit andere tijden:
${tijden}

Noem ALLEEN de volgende diensten, verzin nooit andere diensten:
${diensten}
${uitgeschakeldBlok}`
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

    const tools = bouwTools(config)

    const requestBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: bouwSystemPrompt(config),
      messages: geschiedenis
    }

    if (tools.length > 0) {
      requestBody.tools = tools
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

    const toolUseBlok = data.content.find(b => b.type === 'tool_use')

    if (toolUseBlok && toolUseBlok.name === 'plaas_bestelling') {
      const { items, aantal } = toolUseBlok.input

      const bestellingOmschrijving = items
        .map((item, i) => `${aantal[i]}x ${item}`)
        .join(', ')

      const vervolg = await fetch(API_URL, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: bouwSystemPrompt(config),
          tools,
          messages: [
            ...geschiedenis,
            { role: 'assistant', content: data.content },
            {
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: toolUseBlok.id,
                content: `Bestelling succesvol geplaatst: ${bestellingOmschrijving}`
              }]
            }
          ]
        })
      })

      const vervolgData = await vervolg.json()
      const tekstBlok = vervolgData.content?.find(b => b.type === 'text')

      return {
        statusCode: 200,
        body: JSON.stringify({
          antwoord: tekstBlok?.text || 'Bestelling verwerkt.',
          bestelling: { items, aantal }
        })
      }
    }

    const tekstBlok = data.content.find(b => b.type === 'text')
    return {
      statusCode: 200,
      body: JSON.stringify({ antwoord: tekstBlok?.text || '' })
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ fout: err.message })
    }
  }
}
