const { log, cozyClient, BaseKonnector, categorize } = require('cozy-konnector-libs')
const { getPlutusData, isCredit } = require('./plutus')
const { getToken } = require('./auth')
const fs = require('fs')
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

String.prototype.replaceAll = function (strReplace, strWith) {
  // See http://stackoverflow.com/a/3561711/556609
  var esc = strReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  var reg = new RegExp(esc, 'ig');
  return this.replace(reg, strWith);
};

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

      // write to file for debugging
      fs.writeFileSync('rawTransactions.json', JSON.stringify(rawTransactions, null, 2))
      fs.writeFileSync('transactions.json', JSON.stringify(transactions, null, 2))

      const categorizedTransactions = await categorize(transactions)

      const { accounts: savedAccounts, transactions: savedTransactions } = await reconciliator.save(accounts, categorizedTransactions, { useSplitDate: false })
    } catch (e) {
      log('error', e)
      log('error', e.stack)
    }
  }

  /// Plutus has 2 fixed accounts: card and bank. I only use the card account.
  getAccounts(cardAccount, baseAccount) {
    const cozyCardAccount = {
      "balance": cardAccount.AvailableBalance / 100,
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
      // should be clean_description but currently bugged

      console.log(transaction.description)

      // remove "Crv*" and "Crv" from the label, case insensitive
      let label = transaction.description.replace(/Crv\*?/i, '')

      // Remove ", XX XX 0000" from the label
      label = label.replace(/, .. .. \d{4}$/, '')

      // Remove ", Vilnius" from the label
      label = label.replace(', Vilnius', '')

      console.log(label)
      return {
        "vendorId": transaction.transaction_id,
        "amount": isCredit(transaction) ? amount : -amount,
        "currency": transaction.currency,
        "date": transaction.local_transaction_date,
        "dateImport": new Date().toISOString(),
        "dateOperation": null,
        "label": label,
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
