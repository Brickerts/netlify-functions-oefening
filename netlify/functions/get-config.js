const CONFIG_MAP = {
  demo:   require('../../configs/demo.json'),
  kapper: require('../../configs/kapper.json')
}

exports.handler = async (event) => {
  const klant = event.queryStringParameters?.klant || 'demo'
  const veiligNaam = klant.replace(/[^a-z0-9-_]/gi, '')
  const config = CONFIG_MAP[veiligNaam]

  if (!config) {
    return {
      statusCode: 404,
      body: JSON.stringify({ fout: `Onbekende klant: ${klant}` })
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bedrijfsnaam: config.bedrijfsnaam,
      type: config.type,
      beschrijving: config.beschrijving || '',
      accentKleur: config.accentKleur || null
    })
  }
}
