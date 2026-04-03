const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ fout: 'Method not allowed' }) }
  }

  try {
    const { klant, items, aantal } = JSON.parse(event.body)

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )

    const regels = items.map((item, i) => ({ item, aantal: aantal[i] }))

    const { error } = await supabase
      .from('bestellingen')
      .insert({ klant, items: regels })

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ fout: error.message }) }
    }

    return { statusCode: 200, body: JSON.stringify({ opgeslagen: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
  }
}
