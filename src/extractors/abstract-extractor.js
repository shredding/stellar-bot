const Big = require('big.js')
const StellarSdk = require('stellar-sdk')
const EventEmitter = require('events')

class Extractor {
    extractTipAmount (tipRequest) {
        return undefined
    }

    extractWithdrawal (withdrawalRequest) {
        return undefined
    }
}

module.exports = Extractor