const { createClient } = require('@supabase/supabase-js')

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ fout: 'Method not allowed' }) }
  }

  try {
    const { klant, vraag } = JSON.parse(event.body)

    if (!klant || !vraag) {
      return { statusCode: 400, body: JSON.stringify({ fout: 'klant en vraag zijn verplicht' }) }
    }

    const { data, error } = await supabase().rpc('zoek_documenten', {
      zoek_query: vraag,
      klant_naam: klant,
      aantal:     5
    })

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ fout: error.message }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunks: data || [] })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
  }
}
