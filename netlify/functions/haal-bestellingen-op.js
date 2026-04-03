const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  try {
    const klantFilter = event.queryStringParameters?.klant || null

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )

    let query = supabase
      .from('bestellingen')
      .select('*')
      .order('created_at', { ascending: false })

    if (klantFilter) {
      query = query.eq('klant', klantFilter)
    }

    const { data, error } = await query

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ fout: error.message }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bestellingen: data })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
  }
}
