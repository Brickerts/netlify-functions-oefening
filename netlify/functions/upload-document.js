const { createClient } = require('@supabase/supabase-js')

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL        = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS   = 384
const CHUNK_WOORDEN          = 500
const OVERLAP_WOORDEN        = 50

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

// Knipt tekst in chunks van max CHUNK_WOORDEN woorden met OVERLAP_WOORDEN overlap
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

async function genereerEmbedding(tekst) {
  const res = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model:      EMBEDDING_MODEL,
      input:      tekst,
      dimensions: EMBEDDING_DIMENSIONS
    })
  })

  const data = await res.json()
  if (!data.data?.[0]?.embedding) {
    throw new Error(data.error?.message || 'Embedding mislukt')
  }
  return data.data[0].embedding
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

    const chunks  = maakChunks(content)
    const rijen   = []
    const fouten  = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      try {
        const embedding = await genereerEmbedding(chunk)
        rijen.push({
          klant,
          titel: chunks.length > 1 ? `${titel} (deel ${i + 1}/${chunks.length})` : titel,
          content: chunk,
          embedding
        })
      } catch (e) {
        fouten.push(`Chunk ${i + 1}: ${e.message}`)
      }
    }

    if (!rijen.length) {
      return { statusCode: 500, body: JSON.stringify({ fout: 'Alle embeddings mislukt', fouten }) }
    }

    const { error } = await supabase().from('documenten').insert(rijen)
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ fout: error.message }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opgeslagen: rijen.length,
        chunks:     chunks.length,
        fouten:     fouten.length ? fouten : undefined
      })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
  }
}
