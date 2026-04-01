exports.handler = async (event) => {
  try {
    const { geschiedenis } = JSON.parse(event.body)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: 'Je bent een vriendelijke barista assistent voor café Brasa. Je helpt klanten met bestellingen en vragen over het menu. Spreek altijd Nederlands.',
        messages: geschiedenis
      })
    })

    const data = await response.json()

    if (!data.content) {
      return {
        statusCode: 500,
        body: JSON.stringify({ fout: data.error?.message })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ antwoord: data.content[0].text })
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ fout: err.message })
    }
  }
}
