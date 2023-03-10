const puppeteer = require('puppeteer')
const totp = require("totp-generator");

const baseUrl = 'https://dex.plutus.it'
const dashboardUrl = `${baseUrl}/dashboard`
const loginUrl = `${baseUrl}/auth/login`

module.exports = {
    getToken: async function (connector, username, password, maybe_totp) {
        let browser = await puppeteer.launch();
        let page = await browser.newPage();
        await page.goto(loginUrl);
        await page.waitForSelector('form')

        const form = await page.$('form')

        await form.$('input[name="email"]').then(el => el.type(username))
        await form.$('input[name="password"]').then(el => el.type(password))
        await form.$('button[type="submit"]').then(el => el.click())

        await page.waitForSelector('input[name="code"]', { timeout: 2000 })

        const two_fa_form = await page.$('form')
        if (two_fa_form) {
            await connector.deactivateAutoSuccessfulLogin()

            let code
            if (maybe_totp) {
                code = totp(maybe_totp)
            } else {
                code = await connector.waitForTwoFaCode()
            }
            await two_fa_form.$('input[name="code"]').then(el => el.type(code))
            await two_fa_form.$('button[type="submit"]').then(el => el.click())

            await page.waitForSelector('a[href="/dashboard"]', { timeout: 20000 })
        }

        const jwt = await page.evaluate(() => localStorage.getItem("id_token"));

        await connector.notifySuccessfulLogin()

        await browser.close()
        return jwt
    }
}
