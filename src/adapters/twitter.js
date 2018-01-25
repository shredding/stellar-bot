const TwitterLib = require('twit')
const Adapter = require('./abstract')
const utils = require('../utils')


/**
 * Direct message wrap func
 */
function formatMessage(txt) {
  return txt
}

/**
 * Reply wrap func
 */
function formatReply(txt) {
  return txt
}

class Twitter extends Adapter {

  async onDeposit (sourceAccount, amount) {
    this.client.post('direct_messages/new', {
      screen_name: sourceAccount.uniqueId,
      text: formatMessage(`${amount} XLM have been sucessfully deposited to your account.`)
    })
  }

  async onTipWithInsufficientBalance (tip, amount) {
    this.client.post('direct_messages/new', {
      screen_name: tip.sourceId,
      text: formatMessage(`I can not tip for you. Your balance is insufficient. Deposit and try again.`)
    })
  }

  async onTipTransferFailed(tip, amount) {
    this.client.post('direct_messages/new', {
      screen_name: tip.sourceId,
      text: formatMessage(`I could not tip for you, because of an unknown error. Please try again. Contact the dev team @ https://github.com/shredding/stellar-bot/issues/new if the error persists.`)
    })
  }

  async onTipReferenceError (tip, amount) {
    this.client.post('direct_messages/new', {
      screen_name: tip.sourceId,
      text: formatMessage(`You tried to tip yourself. That does not work.`)
    })
  }

  async onTip (tip, amount) {
    this.client.post('statuses/update',{
      status: formatReply(`You tipped ${amount} XLM to ${tip.targetId}.`),
      in_reply_to_status_id :tweet.id
    })
    this.client.post('direct_messages/new', {
      screen_name: tip.sourceId,
      text: formatMessage(`You tipped ${amount} XLM to ${tip.targetId}.`)
    })
    this.client.post('direct_messages/new', {
      screen_name: tip.targetId,
      text: formatMessage(`${tip.sourceId} tipped ${amount} XLM to you. Have fun and enjoy the stellar experience.`)
    })
  }

  async onWithdrawalReferenceError (uniqueId, address, amount, hash) {
    this.client.post('direct_messages/new', {
      screen_name: uniqueId,
      text: formatMessage(`You tried to withdraw to the bot address. Please try again.`)
    })
  }

  async onWithdrawalDestinationAccountDoesNotExist (uniqueId, address, amount, hash) {
    this.client.post('direct_messages/new', {
      screen_name: uniqueId,
      text: formatMessage(`I could not withdraw. The requested public address does not exist.`)
    })
  }

  async onWithdrawalFailedWithInsufficientBalance (uniqueId, address, amount, hash) {
   this.client.post('direct_messages/new', {
      screen_name: uniqueId,
      text: formatMessage(`I could not withdraw. You requested more than your current balance. Please adjust and try again.`)
    })
  }

  async onWithdrawalInvalidAddress (uniqueId, address ,amount, hash) {
    this.client.post('direct_messages/new', {
      screen_name: uniqueId,
      text: formatMessage(`I could not withdraw, because of an unknown error. Please try again. Contact the dev team @ https://github.com/shredding/stellar-bot/issues/new if the error persists.`)
    })
  }

  async onWithdrawalSubmissionFailed (uniqueId, address, amount, hash) {
    this.onWithdrawalReferenceError(uniqueId, address, amount, hash)
  }

  async onWithdrawal (uniqueId, address, amount, hash) {
    this.client.post('direct_messages/new', {
      screen_name: uniqueId,
      text: formatMessage(`${amount} XLM are on their way to ${address}.`)
    })
  }

  constructor (config) {
    super(config)

    this.name = 'twitter'

    this.client = new TwitterLib({
      consumer_key: process.env.TWITTER_API_KEY,
      consumer_secret: process.env.TWITTER_SECRET_KEY,
      access_token: process.env.TWITTER_ACCESS_TOKEN,
      access_token_secret: process.env.TWITTER_ACCESS_SECRET
    })

    // Find mentions of the @xlm_bot and filter for tips ...
    const tweetStream = this.client.stream('statuses/filter', {track: '@xlm_bot'});
    tweetStream.on('tweet', (tweet) => {
      const tipAmount = this.extractTipAmount(tweet.text)
      if (tipAmount && tweet.in_reply_to_screen_name) {
        this.receivePotentialTip({
          adapter: this.name,
          sourceId: tweet.user.name,
          targetId: tweet.in_reply_to_screen_name,
          amount: tipAmount,
          original: tweet,
          hash: tweet.id
        })
      }
    })

    // parse direct messages
    const userStream = this.client.stream('user')
    userStream.on('direct_message', async (msg) => {
      const txt = msg.direct_message.text.toLowerCase()
      if (txt.indexOf('tell me my balance') > -1) {

        // Balance request
        const balance = await this.requestBalance(this.name, msg.direct_message.sender.screen_name)
        this.client.post('direct_messages/new', {
          screen_name: msg.direct_message.sender.screen_name,
          text: formatMessage(`Your current balance is ${balance} XLM.`)
        })

      } else if (txt.indexOf('refresh my memo id') > -1) {

        // Memo ID refresh
        const options = await this.setAccountOptions(this.name, msg.direct_message.sender.screen_name, {refreshMemoId: true})
        const newMemoId = options.refreshMemoId
        this.client.post('direct_messages/new', {
          screen_name: msg.direct_message.sender.screen_name,
          text: formatMessage(`Your new memoId is ${newMemoId}. Please use it for subsequent deposits.`)
        })

      } else if (txt.indexOf('withdraw') > -1) {

        const extract = this.extractWithdrawal(txt)
        if (!extract) {
          console.log(`XLM withdrawal failed - unparsable message from ${msg.direct_message.sender.screen_name}.`)
          this.client.post('direct_messages/new', {
            screen_name: msg.direct_message.sender.screen_name,
            text: formatMessage(`I could not withdraw. Please make sure that the format matches "withdraw YOUR_AMOUNT XLM to YOUR_PUBLIC_KEY.`)
          })
        } else {
          this.receiveWithdrawalRequest({
            adapter: this.name,
            uniqueId: msg.direct_message.sender.screen_name,
            amount: extract.amount,
            address: extract.address,
            hash: msg.direct_message.id
          })
        }
      }
    })
  }

  extractWithdrawal(txt) {
    const matches = txt.match(/([\d\.]*) XLM to ([\w\d]+)/i)

    if (matches.length === 3) {
      return {
        amount: matches[1],
        address: matches[2]
      }
    }
    return undefined
  }

  /**
   * All supported tipping formats ...
   */
  extractTipAmount (tipText) {
    const matches =  tipText.match(/\+\+\+[\s{1}]?[\d\.]*[\s{1}]?XLM/i)
    return matches ? matches[0].replace('+++', '').replace(/xlm/i, '').replace(/\s/g, '') : undefined
  }
}

module.exports = Twitter