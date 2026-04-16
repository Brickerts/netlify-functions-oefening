const { ok, fail, asyncHandler } = require('./_utils')

const CONFIG_MAP = {
  demo:   require('../../configs/demo.json'),
  kapper: require('../../configs/kapper.json')
}

exports.handler = asyncHandler(async (event) => {
  const klant = event.queryStringParameters?.klant || 'demo'
  const veiligNaam = klant.replace(/[^a-z0-9-_]/gi, '')
  const config = CONFIG_MAP[veiligNaam]

  if (!config) return fail(`Onbekende klant: ${klant}`, 404)

  return ok({
    bedrijfsnaam: config.bedrijfsnaam,
    type: config.type,
    beschrijving: config.beschrijving || '',
    accentKleur: config.accentKleur || null
  })
})
