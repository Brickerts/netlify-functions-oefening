const { createClient } = require('@supabase/supabase-js')

// Testendpoint: GET /.netlify/functions/debug-rag?klant=Demo+Café&vraag=openingstijden
// Toont stap-voor-stap wat er mis is in de RAG-pipeline.
exports.handler = async (event) => {
  const rapport = { stappen: [], ok: true }

  // Stap 1: env vars aanwezig?
  const heeftSupabaseUrl  = !!process.env.SUPABASE_URL
  const heeftSupabaseKey  = !!process.env.SUPABASE_ANON_KEY
  rapport.stappen.push({
    stap: '1 - env vars',
    SUPABASE_URL:      heeftSupabaseUrl  ? '✓' : '✗ ONTBREEKT',
    SUPABASE_ANON_KEY: heeftSupabaseKey  ? '✓' : '✗ ONTBREEKT'
  })

  if (!heeftSupabaseUrl || !heeftSupabaseKey) {
    rapport.ok = false
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rapport, null, 2) }
  }

  const sb    = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const klant = event.queryStringParameters?.klant || 'Demo Café'
  const vraag = event.queryStringParameters?.vraag || 'test'

  // Stap 2: kan Supabase bereikt worden + documenten tellen
  try {
    const { count, error } = await sb
      .from('documenten')
      .select('*', { count: 'exact', head: true })

    if (error) {
      rapport.stappen.push({ stap: '2 - supabase verbinding', fout: error.message })
      rapport.ok = false
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rapport, null, 2) }
    }
    rapport.stappen.push({ stap: '2 - supabase verbinding', totaal_documenten: count })
  } catch (e) {
    rapport.stappen.push({ stap: '2 - supabase verbinding', fout: e.message })
    rapport.ok = false
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rapport, null, 2) }
  }

  // Stap 3: documenten voor deze klant + zoek_vector gevuld?
  try {
    const { data, error } = await sb
      .from('documenten')
      .select('id, klant, titel, created_at, zoek_vector')
      .eq('klant', klant)
      .limit(5)

    if (error) {
      rapport.stappen.push({ stap: `3 - documenten voor klant "${klant}"`, fout: error.message })
    } else {
      rapport.stappen.push({
        stap:   `3 - documenten voor klant "${klant}"`,
        aantal: data.length,
        zoek_vector_gevuld: data.every(d => d.zoek_vector !== null),
        voorbeelden: data.map(d => ({
          titel:             d.titel,
          zoek_vector_null:  d.zoek_vector === null
        }))
      })
    }
  } catch (e) {
    rapport.stappen.push({ stap: '3 - documenten ophalen', fout: e.message })
  }

  // Stap 4: zoek_documenten RPC
  try {
    const { data, error } = await sb.rpc('zoek_documenten', {
      zoek_query: vraag,
      klant_naam: klant,
      aantal:     5
    })

    if (error) {
      rapport.stappen.push({ stap: `4 - RPC zoek_documenten voor "${vraag}"`, fout: error.message })
      rapport.ok = false
    } else {
      rapport.stappen.push({
        stap:      `4 - RPC zoek_documenten voor "${vraag}"`,
        resultaten: data?.length || 0,
        chunks:     (data || []).map(c => ({ titel: c.titel, similarity: c.similarity }))
      })
    }
  } catch (e) {
    rapport.stappen.push({ stap: '4 - RPC', fout: e.message })
    rapport.ok = false
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rapport, null, 2)
  }
}
