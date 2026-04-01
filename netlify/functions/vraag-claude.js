import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function laadConfig(klant) {
  const veiligNaam = (klant || 'demo').replace(/[^a-z0-9-_]/gi, '')
  const bestandspad = path.resolve(__dirname, `../../configs/${veiligNaam}.json`)
  if (!fs.existsSync(bestandspad)) return null
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

// Parses Anthropic's SSE stream. Calls onTextDelta for each text chunk.
// Returns the full array of content blocks (needed for tool_use follow-up).
async function parseAnthropicStream(response, onTextDelta) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const contentBlocks = []
  let currentToolInputJson = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6)
      if (raw === '[DONE]') continue

      let event
      try { event = JSON.parse(raw) } catch { continue }

      if (event.type === 'content_block_start') {
        contentBlocks[event.index] = { ...event.content_block }
        if (event.content_block.type === 'tool_use') currentToolInputJson = ''
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          onTextDelta(event.delta.text)
          if (contentBlocks[event.index]) {
            contentBlocks[event.index].text =
              (contentBlocks[event.index].text || '') + event.delta.text
          }
        } else if (event.delta.type === 'input_json_delta') {
          currentToolInputJson += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        if (contentBlocks[event.index]?.type === 'tool_use') {
          try { contentBlocks[event.index].input = JSON.parse(currentToolInputJson) }
          catch { contentBlocks[event.index].input = {} }
        }
      }
    }
  }

  return contentBlocks
}

export default async (request) => {
  const { geschiedenis, klant } = await request.json()

  const config = laadConfig(klant)
  if (!config) {
    return new Response(
      JSON.stringify({ fout: `Onbekende klant: ${klant}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const tools = bouwTools(config)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        // ── Eerste call (mogelijk met tool use) ──────────────────────────
        const res1 = await fetch(API_URL, {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            system: bouwSystemPrompt(config),
            messages: geschiedenis,
            ...(tools.length > 0 ? { tools } : {}),
            stream: true
          })
        })

        const blocks = await parseAnthropicStream(res1, delta => send({ type: 'text', delta }))
        const toolBlock = blocks.find(b => b.type === 'tool_use')

        if (toolBlock?.name === 'plaas_bestelling') {
          // Tool use: typingindicator blijft zichtbaar totdat res2 tekst stuurt
          const { items, aantal } = toolBlock.input
          const omschrijving = items.map((item, i) => `${aantal[i]}x ${item}`).join(', ')

          const res2 = await fetch(API_URL, {
            method: 'POST',
            headers: apiHeaders(),
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 500,
              system: bouwSystemPrompt(config),
              tools,
              messages: [
                ...geschiedenis,
                { role: 'assistant', content: blocks },
                {
                  role: 'user',
                  content: [{
                    type: 'tool_result',
                    tool_use_id: toolBlock.id,
                    content: `Bestelling succesvol geplaatst: ${omschrijving}`
                  }]
                }
              ],
              stream: true
            })
          })

          await parseAnthropicStream(res2, delta => send({ type: 'text', delta }))
          send({ type: 'done', bestelling: { items, aantal } })
        } else {
          send({ type: 'done' })
        }
      } catch (err) {
        send({ type: 'error', fout: err.message })
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
