const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
}

function ok(data, statusCode = 200) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(data) }
}

function fail(message, statusCode = 500, details = null) {
  console.error(`[fail] ${statusCode} — ${message}`, details ?? '')
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ error: message, details }) }
}

function handleOptions(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }
  return null
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}')
  } catch {
    throw new Error('Invalid JSON in request body')
  }
}

function requireFields(obj, fields) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`Missing required field: ${field}`)
    }
  }
}

function withTimeout(promise, ms = 30000) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  )
  return Promise.race([promise, timer])
}

function asyncHandler(fn) {
  return async (event, context) => {
    const optionsResult = handleOptions(event)
    if (optionsResult) return optionsResult

    try {
      return await fn(event, context)
    } catch (err) {
      console.error('[asyncHandler] Unhandled error:', err.message)
      return fail(err.message, err.statusCode || 500)
    }
  }
}

const { createClient } = require('@supabase/supabase-js')

const USD_TO_EUR = 0.92

const PRIJZEN = {
  // Opus 4.6 / 4.5 — beide zelfde prijs
  'claude-opus-4-6':            { input: 5.00, output: 25.00, cache_read: 0.50, cache_write: 6.25 },
  'claude-opus-4-5':            { input: 5.00, output: 25.00, cache_read: 0.50, cache_write: 6.25 },
  'claude-opus-4-5-20250514':   { input: 5.00, output: 25.00, cache_read: 0.50, cache_write: 6.25 },

  // Sonnet 4.6 / 4.5 — beide zelfde prijs
  'claude-sonnet-4-6':          { input: 3.00, output: 15.00, cache_read: 0.30, cache_write: 3.75 },
  'claude-sonnet-4-5':          { input: 3.00, output: 15.00, cache_read: 0.30, cache_write: 3.75 },
  'claude-sonnet-4-5-20250514': { input: 3.00, output: 15.00, cache_read: 0.30, cache_write: 3.75 },

  // Haiku 4.5
  'claude-haiku-4-5':           { input: 1.00, output: 5.00, cache_read: 0.10, cache_write: 1.25 },
  'claude-haiku-4-5-20251001':  { input: 1.00, output: 5.00, cache_read: 0.10, cache_write: 1.25 }
}

function berekenKosten(model, usage) {
  let prijzen = PRIJZEN[model]
  if (!prijzen) {
    console.warn(`[berekenKosten] Onbekend model "${model}", haiku prijzen als fallback gebruikt.`)
    prijzen = PRIJZEN['claude-haiku-4-5-20251001']
  }

  const input        = (usage.input_tokens               || 0) / 1_000_000 * prijzen.input
  const output       = (usage.output_tokens              || 0) / 1_000_000 * prijzen.output
  const cacheRead    = (usage.cache_read_input_tokens    || 0) / 1_000_000 * prijzen.cache_read
  const cacheWrite   = (usage.cache_creation_input_tokens|| 0) / 1_000_000 * prijzen.cache_write

  return parseFloat(((input + output + cacheRead + cacheWrite) * USD_TO_EUR).toFixed(6))
}

async function logUsage({ klant, function_naam, model, usage }) {
  try {
    const kosten_eur = berekenKosten(model, usage)

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    const { error } = await sb.from('api_usage').insert({
      klant,
      function_naam,
      model,
      input_tokens:           usage.input_tokens               || 0,
      output_tokens:          usage.output_tokens              || 0,
      cache_read_tokens:      usage.cache_read_input_tokens    || 0,
      cache_creation_tokens:  usage.cache_creation_input_tokens|| 0,
      kosten_eur
    })

    if (error) console.error('logUsage failed:', error)
  } catch (err) {
    console.error('logUsage failed:', err)
  }
}

async function checkRateLimit(klant, limieten) {
  try {
    if (!limieten || (limieten.max_calls_per_maand == null && limieten.max_kosten_eur_per_maand == null)) {
      return { allowed: true }
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    const { data, error } = await sb
      .from('api_usage')
      .select('kosten_eur')
      .eq('klant', klant)
      .gte('created_at', startOfMonth)

    if (error) {
      console.warn('[checkRateLimit] Supabase fout, fail open:', error.message)
      return { allowed: true }
    }

    const calls_used  = data.length
    const kosten_used = parseFloat(data.reduce((s, r) => s + (r.kosten_eur || 0), 0).toFixed(4))

    if (limieten.max_calls_per_maand != null && calls_used >= limieten.max_calls_per_maand) {
      return { allowed: false, reason: 'call_limit', calls_used, limit: limieten.max_calls_per_maand }
    }

    if (limieten.max_kosten_eur_per_maand != null && kosten_used >= limieten.max_kosten_eur_per_maand) {
      return { allowed: false, reason: 'kosten_limit', kosten_used, limit: limieten.max_kosten_eur_per_maand }
    }

    return { allowed: true, calls_used, kosten_used }
  } catch (err) {
    console.error('[checkRateLimit] Onverwachte fout, fail open:', err.message)
    return { allowed: true }
  }
}

module.exports = {
  CORS_HEADERS,
  ok,
  fail,
  handleOptions,
  parseBody,
  requireFields,
  withTimeout,
  asyncHandler,
  PRIJZEN,
  berekenKosten,
  logUsage,
  checkRateLimit
}
