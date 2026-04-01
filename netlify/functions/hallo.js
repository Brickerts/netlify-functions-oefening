exports.handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ bericht: "Hallo Rick, de function werkt!" })
  }
}