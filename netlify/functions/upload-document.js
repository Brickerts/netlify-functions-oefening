const { createClient } = require('@supabase/supabase-js')
const { ok, fail, parseBody, requireFields, asyncHandler } = require('./_utils')

const CHUNK_WOORDEN  = 500
const OVERLAP_WOORDEN = 50

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

function maakChunks(tekst) {
  const woorden = tekst.split(/\s+/).filter(Boolean)
  const chunks  = []
  let start     = 0

  while (start < woorden.length) {
    const einde = Math.min(start + CHUNK_WOORDEN, woorden.length)
    chunks.push(woorden.slice(start, einde).join(' '))
    if (einde === woorden.length) break
    start = einde - OVERLAP_WOORDEN
  }

  return chunks
}

exports.handler = asyncHandler(async (event) => {
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 405)

  const body = parseBody(event)
  requireFields(body, ['klant', 'titel', 'content'])
  const { klant, titel, content } = body

  const chunks = maakChunks(content)
  const rijen  = chunks.map((chunk, i) => ({
    klant,
    titel:   chunks.length > 1 ? `${titel} (deel ${i + 1}/${chunks.length})` : titel,
    content: chunk
    // zoek_vector wordt automatisch gevuld door de database trigger
  }))

  const { error } = await supabase().from('documenten').insert(rijen)
  if (error) return fail(error.message)

  return ok({ opgeslagen: rijen.length, chunks: chunks.length })
})
