const { createClient } = require('@supabase/supabase-js')
const { ok, fail, parseBody, requireFields, asyncHandler } = require('./_utils')

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

exports.handler = asyncHandler(async (event) => {
  const method = event.httpMethod

  // GET — ophalen (optioneel filter op klant, datum, status)
  if (method === 'GET') {
    const { klant, datum, status } = event.queryStringParameters || {}

    let query = supabase()
      .from('afspraken')
      .select('*')
      .order('datum', { ascending: true })
      .order('tijd',  { ascending: true })

    if (klant)  query = query.eq('klant', klant)
    if (datum)  query = query.eq('datum', datum)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return fail(error.message)

    return ok({ afspraken: data })
  }

  // POST — nieuwe afspraak aanmaken
  if (method === 'POST') {
    const body = parseBody(event)
    requireFields(body, ['klant', 'naam_klant', 'dienst', 'datum', 'tijd'])
    const { klant, naam_klant, telefoon, dienst, datum, tijd } = body

    const { data, error } = await supabase()
      .from('afspraken')
      .insert({ klant, naam_klant, telefoon, dienst, datum, tijd })
      .select()
      .single()

    if (error) return fail(error.message)
    return ok({ afspraak: data })
  }

  // PATCH — status of velden bijwerken
  if (method === 'PATCH') {
    const body = parseBody(event)
    requireFields(body, ['id'])
    const { id, ...wijzigingen } = body

    const toegestaan = ['naam_klant', 'telefoon', 'dienst', 'datum', 'tijd', 'status']
    const update = Object.fromEntries(
      Object.entries(wijzigingen).filter(([k]) => toegestaan.includes(k))
    )

    if (!Object.keys(update).length) {
      return fail('Geen geldige velden om bij te werken', 400)
    }

    const { data, error } = await supabase()
      .from('afspraken')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return fail(error.message)
    return ok({ afspraak: data })
  }

  // DELETE — afspraak verwijderen
  if (method === 'DELETE') {
    const id = event.queryStringParameters?.id
    if (!id) return fail('id is verplicht', 400)

    const { error } = await supabase()
      .from('afspraken')
      .delete()
      .eq('id', id)

    if (error) return fail(error.message)
    return ok({ verwijderd: true })
  }

  return fail('Methode niet toegestaan', 405)
})
