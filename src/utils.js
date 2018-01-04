const Big = require('big.js')
const StellarSdk = require('stellar-sdk')

module.exports = {

  sleep: (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  extractPayment: (body) => {
    const matches =  body.match(/\+\+\+([\d\.]*)[\s{1}]?XLM/i)
    if (matches) {
      return new Big(matches[1])
    }
    return undefined
  },

  extractWithdrawal: (body) => {
    const parts = body.slice(body.indexOf('<p>') + 3, body.indexOf('</p>')).split('\n')

    if (parts.length === 2) {
      const amount = parts[0].match(/([\d\.]*)/)[0]
      const address = StellarSdk.StrKey.isValidEd25519PublicKey(parts[1]) ? parts[1] : undefined

      if (amount && address) {
        return {
          amount: new Big(amount),
          address: address
        }
      }

      return undefined
    }
  }
}