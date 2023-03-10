const { scrape, log, utils, solveCaptcha, CookieKonnector, BaseKonnector } = require('cozy-konnector-libs')
const puppeteer = require('puppeteer')

const VENDOR = 'Plutus'
const baseUrl = 'https://dex.plutus.it'
const dashboardUrl = `${baseUrl}/dashboard`
const loginUrl = `${baseUrl}/auth/login`

class PlutusConnector extends BaseKonnector {
  async init() {
    this.browser = await puppeteer.launch({ headless: false });
    this.page = await this.browser.newPage();
    await this.page.goto(baseUrl);

    this.jwt = this.getAccountData().jwt
    if (this.jwt) {
      await this.page.evaluate((jwt) => localStorage.setItem("id_token", jwt), jwt)
    }
  }

  static async make(options) {
    let connector = new PlutusConnector(options)
    await connector.init()
    return connector
  }

  async testSession() {
    try {
      await this.page.goto(dashboardUrl)
      await this.page.waitForSelector('a[href="/dashboard"]', { timeout: 3000 })
      return true
    } catch (err) {
      return false
    }
  }

  async authenticate(username, password, maybe_otp) {
    await this.page.goto(loginUrl);
    await this.page.waitForSelector('form')

    const form = await this.page.$('form')

    await form.$('input[name="email"]').then(el => el.type(username))
    await form.$('input[name="password"]').then(el => el.type(password))
    await form.$('button[type="submit"]').then(el => el.click())

    await this.page.waitForSelector('input[name="code"]', { timeout: 2000 })

    const two_fa_form = await this.page.$('form')
    if (two_fa_form) {
      await this.deactivateAutoSuccessfulLogin()

      let code = maybe_otp
      if (!code) {
        code = await this.waitForTwoFaCode()
      }
      await two_fa_form.$('input[name="code"]').then(el => el.type(code))
      await two_fa_form.$('button[type="submit"]').then(el => el.click())

      await this.page.waitForNetworkIdle(3000)
    }

    this.jwt = await this.page.evaluate(() => localStorage.getItem("id_token"));
    this.saveAccountData({ "jwt": this.jwt })

    await this.notifySuccessfulLogin()
  }

  async fetch(fields) {
    log('info', 'Fetching ...')
    if (!(await this.testSession())) {
      log('info', 'Authenticating ...')
      await this.authenticate(fields.login, fields.password, fields.otp)
    }
    log('info', 'Successfully logged in')

    await this.browser.close();

    const myHeaders = new Headers();
    myHeaders.append("Authorization", `Bearer ${this.jwt} `);
    myHeaders.append("Content-Type", "application/json");

    const query = {
      "operationName": "transactions_view",
      "variables": {
        "offset": 0,
        "limit": null,
        "from": null,
        "to": null
      },
      "query": `
      query transactions_view($offset: Int, $limit: Int, $from: timestamptz, $to: timestamptz) {
  transactions_view_aggregate(
    where: { _and: [{ date: { _gte: $from } }, { date: { _lte: $to } }] }
  ) {
    aggregate {
      totalCount: count
      __typename
    }
    __typename
  }
  transactions_view(
    order_by: { date: desc }
    limit: $limit
    offset: $offset
    where: { _and: [{ date: { _gte: $from } }, { date: { _lte: $to } }] }
  ) {
    id
    model
    user_id
    currency
    amount
    date
    type
    is_debit
    description
    __typename
  }
} `
    };

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify(query),
      redirect: 'follow'
    };

    try {
      const response = await fetch("https://hasura.plutus.it/v1alpha1/graphql", requestOptions);
      const result = await response.json();
      console.log(JSON.stringify(result, null, 4));
    }
    catch (error) {
      console.log('error', error);
    }

    log('info', 'Fetching the list of documents')

    log('info', 'Saving data to Cozy')
  }


}

const connector = await PlutusConnector.make({
  cheerio: false,
  json: false
})

connector.run()
