const { createClient } = require('@supabase/supabase-js')

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

exports.handler = async (event) => {
  // ── GET: documenten lijst ophalen ────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const klant = event.queryStringParameters?.klant || null

      let query = supabase()
        .from('documenten')
        .select('id, klant, titel, created_at')
        .order('created_at', { ascending: false })

      if (klant) query = query.eq('klant', klant)

      const { data, error } = await query
      if (error) return { statusCode: 500, body: JSON.stringify({ fout: error.message }) }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documenten: data })
      }
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
    }
  }

  // ── DELETE: document verwijderen ─────────────────────────────────────────
  if (event.httpMethod === 'DELETE') {
    try {
      const { id } = JSON.parse(event.body)
      if (!id) return { statusCode: 400, body: JSON.stringify({ fout: 'id is verplicht' }) }

      const { error } = await supabase().from('documenten').delete().eq('id', id)
      if (error) return { statusCode: 500, body: JSON.stringify({ fout: error.message }) }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verwijderd: true })
      }
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
    }
  }

  return { statusCode: 405, body: JSON.stringify({ fout: 'Method not allowed' }) }
}
