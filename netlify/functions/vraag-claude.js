const fs = require('fs')
const path = require('path')

const config = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../configs/demo.json'), 'utf8')
)

function bouwSystemPrompt(config) {
  const tijden = Object.entries(config.openingstijden)
    .map(([dag, tijd]) => `  - ${dag}: ${tijd}`)
    .join('\n')

  const diensten = config.diensten
    .map(d => `  - ${d}`)
    .join('\n')

  return `Je bent een vriendelijke assistent voor ${config.bedrijfsnaam}, een ${config.type} bedrijf. ${config.beschrijving} Je helpt klanten met vragen en bestellingen. Spreek altijd Nederlands.

Gebruik ALLEEN de volgende openingstijden, verzin nooit andere tijden:
${tijden}

Noem ALLEEN de volgende diensten, verzin nooit andere diensten:
${diensten}`
}

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
    const { geschiedenis } = JSON.parse(event.body)

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
