require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: true });
const { ok, fail, parseBody, requireFields, withTimeout, asyncHandler, logUsage, checkRateLimit } = require('./_utils')

const CONFIG_MAP = {
  demo:   require('../../configs/demo.json'),
  kapper: require('../../configs/kapper.json')
}

function laadConfig(klant) {
  const veiligNaam = (klant || 'demo').replace(/[^a-z0-9-_]/gi, '')
  return CONFIG_MAP[veiligNaam] || null
}

const API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = 'Je bent een document scanner. Extraheer alle informatie uit dit document en geef ALLEEN valid JSON terug: { "bedrijfsnaam": "", "datum": "", "factuurnummer": "", "bedrag_totaal": "", "btw_bedrag": "", "btw_percentage": "", "regels": [{ "omschrijving": "", "aantal": "", "bedrag": "" }], "betaaltermijn": "", "iban": "" }. Als een veld niet leesbaar is, gebruik null.'

const ONDERSTEUNDE_TYPES = {
  'application/pdf': 'document',
  'image/jpeg':      'image',
  'image/jpg':       'image',
  'image/png':       'image'
}

exports.handler = asyncHandler(async (event) => {
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 405)

  const klant = event.queryStringParameters?.klant || 'demo'
  const config = laadConfig(klant)

  const limit = await checkRateLimit(klant, config?.limieten)
  if (!limit.allowed) {
    return ok({
      fout: 'Maandelijkse limiet bereikt voor deze klant. Neem contact op met de eigenaar.',
      rate_limited: true
    })
  }

  const body = parseBody(event)
  requireFields(body, ['bestand', 'mediaType'])
  const { bestand, mediaType } = body

  const bronType = ONDERSTEUNDE_TYPES[mediaType]
  if (!bronType) return fail(`Niet-ondersteund bestandstype: ${mediaType}`, 400)

  const inhoudsBlok = bronType === 'document'
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: bestand } }
    : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: bestand } }

  const response = await withTimeout(fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          inhoudsBlok,
          { type: 'text', text: 'Scan dit document en geef de JSON terug.' }
        ]
      }]
    })
  }), 30000)

  const data = await response.json()
  if (!data.content) return fail(data.error?.message || 'Claude API fout')

  await logUsage({ klant, function_naam: 'scan-document', model: 'claude-opus-4-6', usage: data.usage })

  const tekstBlok = data.content.find(b => b.type === 'text')
  const ruwe = tekstBlok?.text || ''

  // Verwijder eventuele markdown code fences
  const opgeschoond = ruwe.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()

  try {
    const geparsd = JSON.parse(opgeschoond)
    return ok({ resultaat: geparsd })
  } catch {
    // JSON parsing mislukt — stuur de ruwe tekst terug zodat de frontend het kan tonen
    return ok({ resultaat: null, ruweTekst: ruwe })
  }
})
