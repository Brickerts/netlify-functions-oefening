const { createClient } = require('@supabase/supabase-js')

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

exports.handler = async (event) => {
  // ── GET: leads ophalen ───────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const klantFilter = event.queryStringParameters?.klant || null

      let query = supabase()
        .from('leads')
        .select('*')
        .order('laatste_bezoek', { ascending: true, nullsFirst: false })

      if (klantFilter) query = query.eq('klant', klantFilter)

      const { data, error } = await query
      if (error) return { statusCode: 500, body: JSON.stringify({ fout: error.message }) }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: data })
      }
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
    }
  }

  // ── POST: lead toevoegen ─────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const { actie, lead } = JSON.parse(event.body)

      if (actie !== 'toevoegen') {
        return { statusCode: 400, body: JSON.stringify({ fout: 'Onbekende actie' }) }
      }

      const { error } = await supabase().from('leads').insert(lead)
      if (error) return { statusCode: 500, body: JSON.stringify({ fout: error.message }) }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opgeslagen: true })
      }
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
    }
  }

  return { statusCode: 405, body: JSON.stringify({ fout: 'Method not allowed' }) }
}
