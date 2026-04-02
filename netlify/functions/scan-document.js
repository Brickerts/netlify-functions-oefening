const API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = 'Je bent een document scanner. Extraheer alle informatie uit dit document en geef ALLEEN valid JSON terug: { "bedrijfsnaam": "", "datum": "", "factuurnummer": "", "bedrag_totaal": "", "btw_bedrag": "", "btw_percentage": "", "regels": [{ "omschrijving": "", "aantal": "", "bedrag": "" }], "betaaltermijn": "", "iban": "" }. Als een veld niet leesbaar is, gebruik null.'

const ONDERSTEUNDE_TYPES = {
  'application/pdf': 'document',
  'image/jpeg':      'image',
  'image/jpg':       'image',
  'image/png':       'image'
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ fout: 'Method not allowed' }) }
  }

  try {
    const { bestand, mediaType } = JSON.parse(event.body)

    if (!bestand || !mediaType) {
      return { statusCode: 400, body: JSON.stringify({ fout: 'Veld bestand en mediaType zijn verplicht' }) }
    }

    const bronType = ONDERSTEUNDE_TYPES[mediaType]
    if (!bronType) {
      return { statusCode: 400, body: JSON.stringify({ fout: `Niet-ondersteund bestandstype: ${mediaType}` }) }
    }

    const inhoudsBlok = bronType === 'document'
      ? {
          type: 'document',
          source: { type: 'base64', media_type: mediaType, data: bestand }
        }
      : {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: bestand }
        }

    const response = await fetch(API_URL, {
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
    })

    const data = await response.json()

    if (!data.content) {
      return { statusCode: 500, body: JSON.stringify({ fout: data.error?.message }) }
    }

    const tekstBlok = data.content.find(b => b.type === 'text')
    const ruwe = tekstBlok?.text || ''

    // Verwijder eventuele markdown code fences
    const opgeschoond = ruwe.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()

    try {
      const geparsd = JSON.parse(opgeschoond)
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultaat: geparsd })
      }
    } catch {
      // JSON parsing mislukt — stuur de ruwe tekst terug zodat de frontend het kan tonen
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultaat: null, ruweTekst: ruwe })
      }
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
  }
}
