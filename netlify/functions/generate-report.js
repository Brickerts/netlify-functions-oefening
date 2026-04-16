const { createClient } = require('@supabase/supabase-js')
const { ok, fail, parseBody, withTimeout, asyncHandler, logUsage } = require('./_utils')

const API_URL = 'https://api.anthropic.com/v1/messages'

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

function periodeNaarDatums(periode, vanDatum, totDatum) {
  const nu = new Date()
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate())

  if (periode === 'vandaag') {
    return { van: vandaag.toISOString(), tot: nu.toISOString() }
  }
  if (periode === 'week') {
    const start = new Date(vandaag)
    start.setDate(start.getDate() - 6)
    return { van: start.toISOString(), tot: nu.toISOString() }
  }
  if (periode === 'maand') {
    const start = new Date(vandaag)
    start.setDate(start.getDate() - 29)
    return { van: start.toISOString(), tot: nu.toISOString() }
  }
  if (periode === 'aangepast' && vanDatum && totDatum) {
    return { van: new Date(vanDatum).toISOString(), tot: new Date(totDatum + 'T23:59:59').toISOString() }
  }
  // Standaard: afgelopen week
  const start = new Date(vandaag)
  start.setDate(start.getDate() - 6)
  return { van: start.toISOString(), tot: nu.toISOString() }
}

function bouwAnalyse(bestellingen) {
  const itemTotalen = {}
  const uurVerdeling = Array(24).fill(0)

  for (const b of bestellingen) {
    const uur = parseInt(new Date(b.created_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false }), 10)
    uurVerdeling[uur]++

    for (const r of (b.items || [])) {
      const naam = r.item || r.naam || 'onbekend'
      itemTotalen[naam] = (itemTotalen[naam] || 0) + (r.aantal || 1)
    }
  }

  const populaireItems = Object.entries(itemTotalen)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([item, aantal]) => `${item}: ${aantal}x`)

  const piekUren = uurVerdeling
    .map((aantal, uur) => ({ uur, aantal }))
    .filter(u => u.aantal > 0)
    .sort((a, b) => b.aantal - a.aantal)
    .slice(0, 5)
    .map(u => `${String(u.uur).padStart(2, '0')}:00 (${u.aantal} bestellingen)`)

  return { itemTotalen, populaireItems, piekUren, uurVerdeling }
}

exports.handler = asyncHandler(async (event) => {
  if (event.httpMethod !== 'POST') return fail('Method not allowed', 405)

  const { klant, periode, vanDatum, totDatum } = parseBody(event)
  const { van, tot } = periodeNaarDatums(periode, vanDatum, totDatum)

  console.log('[rapport] periode:', periode, '| van:', van, '| tot:', tot, '| klant:', klant || 'alle')

  let query = supabase()
    .from('bestellingen')
    .select('*')
    .gte('created_at', van)
    .lte('created_at', tot)
    .order('created_at', { ascending: true })
    .limit(1000)

  if (klant) query = query.eq('klant', klant)

  const { data: bestellingen, error } = await query

  console.log('[rapport] Supabase resultaat:', bestellingen?.length ?? 'null', 'rijen | fout:', error?.message ?? 'geen')

  if (error) return fail(error.message, 500, { van, tot, klant })

  if (!bestellingen.length) {
    return ok({ rapport: 'Geen bestellingen gevonden in de geselecteerde periode.', aantalBestellingen: 0 })
  }

  const { populaireItems, piekUren } = bouwAnalyse(bestellingen)

  const periodeLabel = {
    vandaag: 'vandaag',
    week:    'afgelopen 7 dagen',
    maand:   'afgelopen 30 dagen',
    aangepast: `${vanDatum} t/m ${totDatum}`
  }[periode] || 'geselecteerde periode'

  const context = `
Klant: ${klant || 'alle klanten'}
Periode: ${periodeLabel}
Totaal bestellingen: ${bestellingen.length}

Populaire items (top 10):
${populaireItems.join('\n') || 'geen data'}

Piekuren:
${piekUren.join('\n') || 'geen data'}

Ruwe bestellingen (laatste 50):
${JSON.stringify(bestellingen.slice(-50), null, 2)}
`.trim()

  const response = await withTimeout(fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: 'Je bent een zakelijke data-analist. Schrijf een beknopt, professioneel rapport in het Nederlands op basis van de verstrekte bestellingdata. Structuur: 1) Samenvatting (2-3 zinnen), 2) Populaire items, 3) Piekuren, 4) Één concrete aanbeveling. Gebruik zakelijke taal. Geen bullet points voor de samenvatting.',
      messages: [{ role: 'user', content: context }]
    })
  }), 30000)

  const data = await response.json()
  if (!data.content) return fail(data.error?.message || 'Claude API fout')

  await logUsage({ klant: klant || 'onbekend', function_naam: 'generate-report', model: 'claude-haiku-4-5-20251001', usage: data.usage })

  return ok({
    rapport: data.content.find(b => b.type === 'text')?.text || '',
    aantalBestellingen: bestellingen.length,
    periode: periodeLabel,
    debug: { van, tot, klant: klant || 'alle' }
  })
})
