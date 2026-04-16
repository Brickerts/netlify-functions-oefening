const { createClient } = require('@supabase/supabase-js')
const { ok, fail, parseBody, requireFields, asyncHandler } = require('./_utils')

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

exports.handler = asyncHandler(async (event) => {
  // ── GET: documenten lijst ophalen ────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const klant = event.queryStringParameters?.klant || null

    let query = supabase()
      .from('documenten')
      .select('id, klant, titel, created_at')
      .order('created_at', { ascending: false })

    if (klant) query = query.eq('klant', klant)

    const { data, error } = await query
    if (error) return fail(error.message)

    return ok({ documenten: data })
  }

  // ── DELETE: document verwijderen ─────────────────────────────────────────
  if (event.httpMethod === 'DELETE') {
    const body = parseBody(event)
    requireFields(body, ['id'])

    const { error } = await supabase().from('documenten').delete().eq('id', body.id)
    if (error) return fail(error.message)

    return ok({ verwijderd: true })
  }

  return fail('Method not allowed', 405)
})
