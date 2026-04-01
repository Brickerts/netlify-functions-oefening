const fs = require('fs')
const path = require('path')

exports.handler = async (event) => {
  const klant = event.queryStringParameters?.klant || 'demo'
  const veiligNaam = klant.replace(/[^a-z0-9-_]/gi, '')
  const bestandspad = path.resolve(__dirname, `../../configs/${veiligNaam}.json`)

  if (!fs.existsSync(bestandspad)) {
    return {
      statusCode: 404,
      body: JSON.stringify({ fout: `Onbekende klant: ${klant}` })
    }
  }

  const config = JSON.parse(fs.readFileSync(bestandspad, 'utf8'))

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
