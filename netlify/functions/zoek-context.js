const { createClient } = require('@supabase/supabase-js')
const { ok, fail, parseBody, requireFields, asyncHandler } = require('./_utils')

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

exports.handler = asyncHandler(async (event) => {
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 405)

  const body = parseBody(event)
  requireFields(body, ['klant', 'vraag'])
  const { klant, vraag } = body

  const sb = supabase()

  // Poging 1: full-text search
  const { data: ftsData, error: ftsError } = await sb.rpc('zoek_documenten', {
    zoek_query: vraag,
    klant_naam: klant,
    aantal:     5
  })

  if (ftsError) return fail(ftsError.message, 500, { stap: 'fts' })

  if (ftsData && ftsData.length > 0) {
    return ok({ chunks: ftsData, bron: 'fts' })
  }

  // Poging 2: fallback naar meest recente documenten
  const { data: recentData, error: recentError } = await sb
    .from('documenten')
    .select('id, titel, content')
    .eq('klant', klant)
    .order('created_at', { ascending: false })
    .limit(3)

  if (recentError) return fail(recentError.message, 500, { stap: 'fallback' })

  return ok({ chunks: recentData || [], bron: 'fallback' })
})
