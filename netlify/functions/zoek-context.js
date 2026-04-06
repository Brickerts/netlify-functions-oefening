const { createClient } = require('@supabase/supabase-js')

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL        = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS   = 384

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
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
    const { klant, vraag } = JSON.parse(event.body)

    if (!klant || !vraag) {
      return { statusCode: 400, body: JSON.stringify({ fout: 'klant en vraag zijn verplicht' }) }
    }

    const embedding = await genereerEmbedding(vraag)

    const { data, error } = await supabase().rpc('zoek_documenten', {
      query_embedding: embedding,
      klant_naam:      klant,
      aantal:          5
    })

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ fout: error.message }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunks: data || [] })
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ fout: err.message }) }
  }
}
