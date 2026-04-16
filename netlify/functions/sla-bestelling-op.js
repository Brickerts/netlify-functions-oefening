const { createClient } = require('@supabase/supabase-js')
const { ok, fail, parseBody, requireFields, asyncHandler } = require('./_utils')

exports.handler = asyncHandler(async (event) => {
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 405)

  const body = parseBody(event)
  requireFields(body, ['klant', 'items', 'aantal'])
  const { klant, items, aantal } = body

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  const regels = items.map((item, i) => ({ item, aantal: aantal[i] }))

  const { error } = await supabase
    .from('bestellingen')
    .insert({ klant, items: regels })

  if (error) return fail(error.message)

  return ok({ opgeslagen: true })
})
