const Snoowrap = require('snoowrap')
const Adapter = require('./abstract')
const utils = require('../utils')

// *** +++ Reddit API +
function getR() {
  const r = new Snoowrap({
    userAgent: process.env.REDDIT_USER,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USER,
    password: process.env.REDDIT_PASS,
  })

  r.config({
    continueAfterRatelimitError: true,
    warnings: false,
    maxRetryAttempts: 10
  })

  return r
}


/**
 * Reddit sometimes get's out of reach and throws 503.
 *
 * This is not very problematic for us, as we can collect comments and messages later
 * on and only very, very rarely tips will fail (leaving the balance untouched).
 */
async function callReddit(func, data, client) {
  client = client || getR()

  try {
    return await client[func](data)
  } catch (exc) {
    console.error(`${exc.name} - Failed to execute ${func} with data:`, data)
  }
}

/**
 * Adds the bot footer to the message.
 */
function formatMessage(txt) {
  return txt +
    '\n\n\n\n' +
    '[Deposit](https://www.reddit.com/user/stellar_bot/comments/7o2ex9/deposit/) | ' +
    `[Withdraw](https://np.reddit.com/message/compose/?to=${process.env.REDDIT_USER}&subject=Withdraw&message=Amount%20XLM%0Aaddress%20here) | ` +
    `[Balance](https://np.reddit.com/message/compose/?to=${process.env.REDDIT_USER}&subject=Balance&message=Tell%20me%20my%20XLM%20Balance!) | ` +
    '[Help](https://www.reddit.com/user/stellar_bot/comments/7o2gnd/help/) | ' +
    '[Donate](https://www.reddit.com/user/stellar_bot/comments/7o2ffl/donate/) | ' +
    '[About Stellar](https://www.stellar.org/)'
}

class Reddit extends Adapter {

  async sendDepositConfirmation (sourceAccount, amount) {
    await callReddit('composeMessage', {
      to: sourceAccount.uniqueId,
      subject: 'XLM Deposit',
      text: formatMessage(`**${amount} XLM** have been sucessfully deposited to your account.`)
    })
  }

  async onTipWithInsufficientBalance (tip, amount) {
    console.log(`${tip.sourceId} tipped with insufficient balance.`)
    callReddit('composeMessage', {
      to: tip.sourceId,
      subject: 'Tipping failed',
      text: formatMessage(`I can not tip for you. Your balance is insufficient. Deposit and try again.`)
    })
  }

  async onTipTransferFailed(tip, amount) {
    console.log(`Tip transfer failed for ${tip.sourceId}.`)
    callReddit('composeMessage', {
      to: tip.sourceId,
      subject: 'Tipping failed',
      text: formatMessage(`I could not tip for you, because of an unknown error. Please try again. [Contact the dev team](https://github.com/shredding/stellar-bot/issues/new) if the error persists.`)
    })
  }

  async onTipReferenceError (tip, amount) {
    console.log(`Tip reference error for ${tip.sourceId}.`)
    callReddit('composeMessage', {
      to: tip.sourceId,
      subject: 'Tipping failed',
      text: formatMessage(`You tried to tip yourself. That does not work.`)
    })
  }

  async onTip (tip, amount) {
    console.log(`${amount} tip from ${tip.sourceId} to ${tip.targetId}.`)
    await callReddit('reply', formatMessage(`You tipped **${amount} XLM** to *${tip.targetId}*.`), tip.original)
    callReddit('composeMessage', {
      to: tip.sourceId,
      subject: 'Tipped!',
      text: formatMessage(`You tipped **${amount} XLM** to *${tip.targetId}*.`)
    })
    callReddit('composeMessage', {
      to: tip.targetId,
      subject: 'Tipped!',
      text: formatMessage(`*${tip.sourceId}* tipped **${amount} XLM** to you. Have fun and enjoy the stellar experience.`)
    })
  }

  async onWithdrawalReferenceError (uniqueId, address, amount, hash) {
    console.log(`XLM withdrawal failed - unknown error for ${uniqueId}.`)
    callReddit('composeMessage', {
      to: uniqueId,
      subject: 'XLM Withdrawal failed',
      text: formatMessage(`You tried to withdraw to the bot address. Please try again.`)
    })
  }

  async onWithdrawalDestinationAccountDoesNotExist (uniqueId, address, amount, hash) {
    console.log(`XLM withdrawal failed - no public address for ${uniqueId}.`)
    await callReddit('composeMessage', {
      to: uniqueId,
      subject: 'XLM Withdrawal failed',
      text: formatMessage(`I could not withdraw. The requested public address does not exist.`)
    })
  }

  async onWithdrawalFailedWithInsufficientBalance (uniqueId, address, amount, hash) {
    console.log(`XLM withdrawal failed - insufficient balance for ${uniqueId}.`)
    await callReddit('composeMessage', {
      to: address,
      subject: 'XLM Withdrawal failed',
      text: formatMessage(`I could not withdraw. You requested more than your current balance. Please adjust and try again.`)
    })
  }

  async onWithdrawalInvalidAddress (uniqueId, address ,amount, hash) {
    console.log(`XLM withdrawal failed - invalid address ${address}.`)
    await callReddit('composeMessage', {
      to: address,
      subject: 'XLM Withdrawal failed',
      text: formatMessage(`I could not withdraw, because of an unknown error. Please try again. [Contact the dev team](https://github.com/shredding/stellar-bot/issues/new) if the error persists.`)
    })
  }

  async onWithdrawalSubmissionFailed (uniqueId, address, amount, hash) {
    this.emit('withdrawalSubmissionFailed ', uniqueId, address, amount, hash)
  }

  async onWithdrawal (uniqueId, address, amount, hash) {
    await callReddit('composeMessage', {
      to: uniqueId,
      subject: 'XLM Withdrawal',
      text: formatMessage(`**${amount} XLM** are on their way to ${address}.`)
    })
  }

  constructor (config) {
    super(config)

    this.name = 'reddit'

    this.pollComments()
    this.pollMessages()
  }

  /**
   * Polls comments in the registered subreddits every 2 secs.
   */
  async pollComments (lastBatch) {
    lastBatch = lastBatch || []

    const comments = await callReddit('getNewComments', 'Stellar')

    if (comments === undefined) {
      return this.pollComments(lastBatch)
    }

    comments.filter((comment) => {
      return lastBatch.every(batch => batch.id != comment.id)
    }).forEach(async (comment) => {
      const tipAmount = this.extractTipAmount(comment.body)
      if (tipAmount) {
        const targetComment = await callReddit('getComment', comment.parent_id)
        if (targetComment) {
          this.receivePotentialTip({
            adapter: this.name,
            sourceId: comment.author.name,
            targetId: await targetComment.author.name,
            amount: tipAmount,
            original: comment,
            hash: comment.id
          })
        }
      }
    })

    lastBatch = comments
    await utils.sleep(2000)
    this.pollComments(lastBatch)
  }

  /**
   * Polls unread messages to the bot and answers them.
   */
  async pollMessages () {
    const messages = await callReddit('getUnreadMessages') || []
    let processedMessages = []

    await messages
      .filter(m => ['Withdraw', 'Balance'].indexOf(m.subject) > -1 && !m.was_comment)
      .forEach(async (m) => {
        // Check the balance of the user
        if (m.subject === 'Balance') {
          const balance = await this.requestBalance(this.name, m.author.name)
          await callReddit('composeMessage', {
            to: m.author.name,
            subject: 'XLM Balance',
            text: formatMessage(`Your current balance is **${balance} XLM**.`)
          })
          console.log(`Balance request answered for ${m.author.name}.`)
          await callReddit('markMessagesAsRead', [m])
        }

        if (m.subject === 'Withdraw') {
          const extract = this.extractWithdrawal(m.body_html)

          if (!extract) {
            console.log(`XLM withdrawal failed - unparsable message from ${m.author.name}.`)
            await callReddit('composeMessage', {
              to: m.author.name,
              subject: 'XLM Withdrawal failed',
              text: formatMessage(`I could not withdraw. Please make sure that the first line of the body is withdrawal amount and the second line your public key.`)
            })
          } else {
              console.log(`XLM withdrawal initiated for ${m.author.name}.`)
              await callReddit('markMessagesAsRead', [m])
              this.receiveWithdrawalRequest({
                adapter: this.name,
                uniqueId: m.author.name,
                amount: extract.amount,
                address: extract.address,
                hash: m.id
              })
            }
          }
          await callReddit('markMessagesAsRead', [m])
      })

    await utils.sleep(2000)
    this.pollMessages()
  }

  /**
   * All supported tipping formats ...
   */
  extractTipAmount (tipText) {
    const matches =  tipText.match(/\+\+\+[\s{1}]?[\d\.]*[\s{1}]?XLM/i)
    return matches ? matches[0].replace('+++', '').replace(/xlm/i, '').replace(/\s/g, '') : undefined
  }

  /**
   * Extract withdrawal information from the message.
   */
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

module.exports = Reddit