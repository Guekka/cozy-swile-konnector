const { log, cozyClient, BaseKonnector, categorize } = require('cozy-konnector-libs')
const { getPlutusData } = require('./plutus')
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

const VENDOR = 'Plutus'
class PlutusConnector extends BaseKonnector {
  async fetch(fields) {
    log('info', 'Authenticating ...')
    this.jwt = await getToken(this, fields.login, fields.password, fields.totp)
    log('info', 'Successfully logged in')

    if (this.browser) {
      await this.browser.close();
    }
    try {

      const plutusData = await getPlutusData(this.jwt)

      log('info', 'Successfully fetched data')
      log('info', 'Parsing ...')

      const { transactions: rawTransactions, cardAccount, baseAccount } = plutusData

      const accounts = this.getAccounts(cardAccount, baseAccount)
      const transactions = this.getTransactions(rawTransactions, accounts)
      const categorizedTransactions = await categorize(transactions)

      const { accounts: savedAccounts } = await reconciliator.save(accounts, categorizedTransactions)
    } catch (e) {
      log('error', e)
      log('error', e.stack)
    }
  }

  /// Plutus has 2 fixed accounts: card and bank. I only use the card account.
  getAccounts(cardAccount, baseAccount) {
    const cozyCardAccount = {
      "balance": cardAccount.AccountBalance / 100,
      "institutionLabel": VENDOR,
      "label": "Carte Plutus",
      // "iban": not available
      "number": String(cardAccount.AccountIdentifier),
      "type": "credit card",
      "idAccount": String(cardAccount.AccountIdentifier),
      "vendorId": String(cardAccount.AccountIdentifier),
      "currency": cardAccount.currency,
    }
    /*
    const cozyBaseAccount = {
      _id: baseAccount.id,
      "balance": baseAccount.amount / 100,
      "institutionLabel": VENDOR,
      "label": "Bank",
      // "iban": not available
      "number": "2",
      "type": "check",
      "vendorId": baseAccount.id,
      "currency": baseAccount.currency,
    }
    */
    return [cozyCardAccount]
  }


  getTransactions(transactions, accounts) {
    return transactions.map(transaction => {
      let amount = transaction.transaction_amount / 100
      return {
        "vendorId": transaction.transaction_id,
        "amount": transaction.is_debit ? -amount : amount,
        "currency": transaction.currency,
        "date": transaction.date,
        "dateImport": new Date().toISOString(),
        "dateOperation": null,
        "label": transaction.cleanDescription ?? transaction.description ?? "No description",
        "originalBankLabel": transaction.description,
        "vendorAccountId": accounts[0].vendorId,
        "type": transaction.type === "PURCHASE" ? "credit card" : "transfer",
      }
    })
  }
}

const connector = new PlutusConnector({
  cheerio: false,
  json: false
})

connector.run()
