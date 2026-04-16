const { createClient } = require('@supabase/supabase-js')
const { ok, fail, parseBody, requireFields, asyncHandler } = require('./_utils')

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

exports.handler = asyncHandler(async (event) => {
  // ── GET: leads ophalen ───────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const klantFilter = event.queryStringParameters?.klant || null

    let query = supabase()
      .from('leads')
      .select('*')
      .order('laatste_bezoek', { ascending: true, nullsFirst: false })

    if (klantFilter) query = query.eq('klant', klantFilter)

    const { data, error } = await query
    if (error) return fail(error.message)

    return ok({ leads: data })
  }

  // ── POST: lead toevoegen ─────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    const body = parseBody(event)
    requireFields(body, ['actie', 'lead'])

    if (body.actie !== 'toevoegen') {
      return fail('Onbekende actie', 400)
    }

    const { error } = await supabase().from('leads').insert(body.lead)
    if (error) return fail(error.message)

    return ok({ opgeslagen: true })
  }

  return fail('Method not allowed', 405)
})
