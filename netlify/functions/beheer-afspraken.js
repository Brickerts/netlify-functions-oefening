const { createClient } = require('@supabase/supabase-js')

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

exports.handler = async (event) => {
  const method = event.httpMethod

  try {
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
      if (error) return err(error.message)

      return ok({ afspraken: data })
    }

    // POST — nieuwe afspraak aanmaken
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { klant, naam_klant, telefoon, dienst, datum, tijd } = body

      if (!klant || !naam_klant || !dienst || !datum || !tijd) {
        return { statusCode: 400, body: JSON.stringify({ fout: 'Verplichte velden ontbreken: klant, naam_klant, dienst, datum, tijd' }) }
      }

      const { data, error } = await supabase()
        .from('afspraken')
        .insert({ klant, naam_klant, telefoon, dienst, datum, tijd })
        .select()
        .single()

      if (error) return err(error.message)
      return ok({ afspraak: data })
    }

    // PATCH — status of tijd bijwerken
    if (method === 'PATCH') {
      const body = JSON.parse(event.body || '{}')
      const { id, ...wijzigingen } = body

      if (!id) return { statusCode: 400, body: JSON.stringify({ fout: 'id is verplicht' }) }

      const toegestaan = ['naam_klant', 'telefoon', 'dienst', 'datum', 'tijd', 'status']
      const update = Object.fromEntries(
        Object.entries(wijzigingen).filter(([k]) => toegestaan.includes(k))
      )

      if (!Object.keys(update).length) {
        return { statusCode: 400, body: JSON.stringify({ fout: 'Geen geldige velden om bij te werken' }) }
      }

      const { data, error } = await supabase()
        .from('afspraken')
        .update(update)
        .eq('id', id)
        .select()
        .single()

      if (error) return err(error.message)
      return ok({ afspraak: data })
    }

    // DELETE — afspraak verwijderen
    if (method === 'DELETE') {
      const id = event.queryStringParameters?.id
      if (!id) return { statusCode: 400, body: JSON.stringify({ fout: 'id is verplicht' }) }

      const { error } = await supabase()
        .from('afspraken')
        .delete()
        .eq('id', id)

      if (error) return err(error.message)
      return ok({ verwijderd: true })
    }

    return { statusCode: 405, body: JSON.stringify({ fout: 'Methode niet toegestaan' }) }

  } catch (e) {
    return err(e.message)
  }
}

function ok(body)  { return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } }
function err(msg)  { return { statusCode: 500, body: JSON.stringify({ fout: msg }) } }
