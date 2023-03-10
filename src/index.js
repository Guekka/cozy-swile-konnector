const { log, cozyClient, BaseKonnector } = require('cozy-konnector-libs')
const { getPlutusData } = require('./plutus')
const { getToken } = require('./auth')


const VENDOR = 'Plutus'
class PlutusConnector extends BaseKonnector {
  async fetch(fields) {
    log('info', 'Authenticating ...')
    this.jwt = await getToken(this, fields.login, fields.password, fields.totp)
    log('info', 'Successfully logged in')

    if (this.browser) {
      await this.browser.close();
    }

    log('info', this.jwt)

    const plutusData = await getPlutusData(this.jwt)

    log('info', 'Successfully fetched data')
    log('info', 'Parsing ...')

    log('info', JSON.stringify(plutusData, null, 4))
  }


}

const connector = new PlutusConnector({
  cheerio: false,
  json: false
})

connector.run()
