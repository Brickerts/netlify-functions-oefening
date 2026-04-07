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

    const sb = supabase()

    // Poging 1: full-text search
    const { data: ftsData, error: ftsError } = await sb.rpc('zoek_documenten', {
      zoek_query: vraag,
      klant_naam: klant,
      aantal:     5
    })

    if (ftsError) {
      return { statusCode: 500, body: JSON.stringify({ fout: ftsError.message, stap: 'fts' }) }
    }

    if (ftsData && ftsData.length > 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunks: ftsData, bron: 'fts' })
      }
    }

    // Poging 2: fallback naar meest recente documenten
    const { data: recentData, error: recentError } = await sb
      .from('documenten')
      .select('id, titel, content')
      .eq('klant', klant)
      .order('created_at', { ascending: false })
      .limit(3)

    if (recentError) {
      return { statusCode: 500, body: JSON.stringify({ fout: recentError.message, stap: 'fallback' }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunks: recentData || [], bron: 'fallback' })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
  }
}
