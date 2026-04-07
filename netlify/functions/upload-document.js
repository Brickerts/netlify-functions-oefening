const { createClient } = require('@supabase/supabase-js')

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ fout: 'Method not allowed' }) }
  }

  try {
    const { klant, titel, content } = JSON.parse(event.body)

    if (!klant || !titel || !content) {
      return { statusCode: 400, body: JSON.stringify({ fout: 'klant, titel en content zijn verplicht' }) }
    }

    const chunks = maakChunks(content)
    const rijen  = chunks.map((chunk, i) => ({
      klant,
      titel:   chunks.length > 1 ? `${titel} (deel ${i + 1}/${chunks.length})` : titel,
      content: chunk
      // zoek_vector wordt automatisch gevuld door de database trigger
    }))

    const { error } = await supabase().from('documenten').insert(rijen)
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ fout: error.message }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opgeslagen: rijen.length, chunks: chunks.length })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
  }
}
