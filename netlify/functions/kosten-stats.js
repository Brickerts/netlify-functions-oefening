const { createClient } = require('@supabase/supabase-js')
const { ok, fail, asyncHandler } = require('./_utils')

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

function startDatum(periode) {
  const nu = new Date()
  if (periode === 'week') {
    const d = new Date(nu)
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }
  if (periode === 'maand') {
    return new Date(nu.getFullYear(), nu.getMonth(), 1).toISOString()
  }
  return null // 'alles'
}

exports.handler = asyncHandler(async (event) => {
  if (event.httpMethod !== 'GET') return fail('Method not allowed', 405)

  const periode = event.queryStringParameters?.periode || 'maand'

  let query = supabase()
    .from('api_usage')
    .select('*')
    .order('created_at', { ascending: false })

  const van = startDatum(periode)
  if (van) query = query.gte('created_at', van)

  const { data, error } = await query
  if (error) return fail(error.message)

  const rijen = data || []

  // Totalen
  const totaal_calls = rijen.length
  const totaal_kosten_eur = parseFloat(
    rijen.reduce((s, r) => s + (r.kosten_eur || 0), 0).toFixed(4)
  )

  // Per klant
  const klantMap = {}
  for (const r of rijen) {
    const k = r.klant || 'onbekend'
    if (!klantMap[k]) klantMap[k] = { klant: k, calls: 0, kosten_eur: 0 }
    klantMap[k].calls++
    klantMap[k].kosten_eur += r.kosten_eur || 0
  }
  const per_klant = Object.values(klantMap)
    .map(k => ({
      ...k,
      kosten_eur: parseFloat(k.kosten_eur.toFixed(4)),
      percentage: totaal_kosten_eur > 0
        ? parseFloat(((k.kosten_eur / totaal_kosten_eur) * 100).toFixed(1))
        : 0
    }))
    .sort((a, b) => b.kosten_eur - a.kosten_eur)

  // Per function
  const fnMap = {}
  for (const r of rijen) {
    const f = r.function_naam || 'onbekend'
    if (!fnMap[f]) fnMap[f] = { function_naam: f, calls: 0, kosten_eur: 0 }
    fnMap[f].calls++
    fnMap[f].kosten_eur += r.kosten_eur || 0
  }
  const per_function = Object.values(fnMap)
    .map(f => ({ ...f, kosten_eur: parseFloat(f.kosten_eur.toFixed(4)) }))
    .sort((a, b) => b.kosten_eur - a.kosten_eur)

  // Per dag
  const dagMap = {}
  for (const r of rijen) {
    const datum = r.created_at?.slice(0, 10) || 'onbekend'
    if (!dagMap[datum]) dagMap[datum] = { datum, calls: 0, kosten_eur: 0 }
    dagMap[datum].calls++
    dagMap[datum].kosten_eur += r.kosten_eur || 0
  }
  const per_dag = Object.values(dagMap)
    .map(d => ({ ...d, kosten_eur: parseFloat(d.kosten_eur.toFixed(4)) }))
    .sort((a, b) => a.datum.localeCompare(b.datum))

  // Laatste 10
  const laatste_10 = rijen.slice(0, 10).map(r => ({
    klant:         r.klant,
    function_naam: r.function_naam,
    model:         r.model,
    kosten_eur:    parseFloat((r.kosten_eur || 0).toFixed(4)),
    created_at:    r.created_at
  }))

  return ok({ periode, totaal_calls, totaal_kosten_eur, per_klant, per_function, per_dag, laatste_10 })
})
