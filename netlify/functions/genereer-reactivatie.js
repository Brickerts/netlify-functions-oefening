const { ok, fail, parseBody, requireFields, withTimeout, asyncHandler, logUsage } = require('./_utils')

const API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = 'Je bent een marketing specialist. Schrijf een kort, persoonlijk reactivatie-bericht (max 3 zinnen) voor een klant die al een tijd niet langs is geweest. Gebruik hun naam en het type bedrijf. Toon: warm, niet opdringerig. Geef ALLEEN het bericht terug, geen uitleg.'

exports.handler = asyncHandler(async (event) => {
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 405)

  const body = parseBody(event)
  requireFields(body, ['lead'])

  const { lead, bedrijfsnaam, bedrijfstype } = body

  if (!lead.naam) return fail('lead.naam is verplicht', 400)

  const dagenlang = lead.laatste_bezoek
    ? Math.floor((Date.now() - new Date(lead.laatste_bezoek)) / 86400000)
    : null

  const context = [
    `Klantnaam: ${lead.naam}`,
    `Bedrijf: ${bedrijfsnaam || 'onbekend'} (${bedrijfstype || 'bedrijf'})`,
    dagenlang !== null ? `Laatste bezoek: ${dagenlang} dagen geleden` : null,
    lead.totaal_bezoeken ? `Totaal bezoeken: ${lead.totaal_bezoeken}` : null,
    lead.notities ? `Notities: ${lead.notities}` : null
  ].filter(Boolean).join('\n')

  const response = await withTimeout(fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }]
    })
  }), 30000)

  const data = await response.json()
  if (!data.content) return fail(data.error?.message || 'Claude API fout')

  await logUsage({ klant: 'onbekend', function_naam: 'genereer-reactivatie', model: 'claude-haiku-4-5-20251001', usage: data.usage })

  const bericht = data.content.find(b => b.type === 'text')?.text || ''
  return ok({ bericht })
})
