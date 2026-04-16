const { createClient } = require('@supabase/supabase-js')
const { ok, fail, asyncHandler } = require('./_utils')

exports.handler = asyncHandler(async (event) => {
  const klantFilter = event.queryStringParameters?.klant || null

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  let query = supabase
    .from('bestellingen')
    .select('*')
    .order('created_at', { ascending: false })

  if (klantFilter) {
    query = query.eq('klant', klantFilter)
  }

  const { data, error } = await query
  if (error) return fail(error.message)

  return ok({ bestellingen: data })
})
