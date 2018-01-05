const Extractor = require('./abstract-extractor')

class RedditExtractor extends Extractor {
    extractTipAmount (tipText) {
        const matches =  tipText.match(/\+\+\+([\d\.]*)[\s{1}]?XLM/i)
        if (matches) {
            return matches[1]
        }
        return undefined
    }

    extractWithdrawal (body) {
        const parts = body.slice(body.indexOf('<p>') + 3, body.indexOf('</p>')).split('\n')

        if (parts.length === 2) {
            const amount = parts[0].match(/([\d\.]*)/)[0]
            const address = parts[1]

            if (amount && address) {
                return {
                    amount, address
                }
            }
            return undefined
        }
    }
}

module.exports = RedditExtractor