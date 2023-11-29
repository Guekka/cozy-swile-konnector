const { log, cozyClient, BaseKonnector, categorize } = require('cozy-konnector-libs')
const { getSwileData } = require('./swile')
const { getToken } = require('./auth')
const doctypes = require('cozy-doctypes')
const {
    Document,
    BankAccount,
    BankTransaction,
    BankingReconciliator
} = doctypes

Document.registerClient(cozyClient)

const reconciliator = new BankingReconciliator({ BankAccount, BankTransaction })

const VENDOR = 'Swile'

class SwileConnector extends BaseKonnector {
    async fetch(fields) {
        log('info', 'Authenticating ...')
        this.jwt = await getToken(this, fields.login, fields.password)
        log('info', 'Successfully logged in')

        if (this.browser) {
            await this.browser.close();
        }
        try {
            const swileData = await getSwileData(this.jwt)

            log('info', 'Successfully fetched data')
            log('info', 'Parsing ...')

            const account = this.makeAccount(swileData.account)
            const transactions = this.getTransactions(swileData.transactions, account)

            const categorizedTransactions = await categorize(transactions)

            await reconciliator.save([account], categorizedTransactions)
        } catch (e) {
            log('error', e)
            log('error', e.stack)
        }
    }

    makeAccount(account) {
        return {
            "balance": account.meal_voucher_info.balance.value,
            "institutionLabel": VENDOR,
            "label": VENDOR,
            "number": String(account.id),
            "type": "bank",
            "idAccount": String(account.id),
            "vendorId": String(account.id),
            "currency": account.meal_voucher_info.balance.currency.iso_3,
        }
    }

    getTransactions(transactions, account) {
        return transactions.map(transaction => {
            // remove "Crv*" and "Crv" from the label, case insensitive
            let label = transaction.name.replace(/Crv\*?/i, '')

            return {
                "vendorId": transaction.id,
                "amount": transaction.transactions[0].amount.value / 100,
                "currency": transaction.amount.currency.iso_3,
                "date": transaction.date,
                "dateImport": new Date().toISOString(),
                "dateOperation": null,
                "label": label,
                "originalBankLabel": transaction.name,
                "vendorAccountId": account.vendorId,
                "type": transaction.display_type === "Payment" ? "credit card" : "transfer",
            }
        })
    }
}

const connector = new SwileConnector({
    cheerio: false,
    json: false
})

connector.run()
