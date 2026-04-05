const API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = 'Je bent een marketing specialist. Schrijf een kort, persoonlijk reactivatie-bericht (max 3 zinnen) voor een klant die al een tijd niet langs is geweest. Gebruik hun naam en het type bedrijf. Toon: warm, niet opdringerig. Geef ALLEEN het bericht terug, geen uitleg.'

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ fout: 'Method not allowed' }) }
  }

  try {
    const { lead, bedrijfsnaam, bedrijfstype } = JSON.parse(event.body)

    if (!lead?.naam) {
      return { statusCode: 400, body: JSON.stringify({ fout: 'lead.naam is verplicht' }) }
    }

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

    const response = await fetch(API_URL, {
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
        messages: [{
          role: 'user',
          content: context
        }]
      })
    })

    const data = await response.json()

    if (!data.content) {
      return { statusCode: 500, body: JSON.stringify({ fout: data.error?.message }) }
    }

    const bericht = data.content.find(b => b.type === 'text')?.text || ''
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bericht })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
  }
}
