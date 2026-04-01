const fs = require('fs')
const path = require('path')

const config = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../configs/demo.json'), 'utf8')
)

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bedrijfsnaam: config.bedrijfsnaam,
      type: config.type
    })
  }
}
