const Snoowrap = require('snoowrap')
const Adapter = require('./abstract-adapter')

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

async function callReddit(func, data, client) {
  client = client || getR()

  try {
    return await client[func](data)
  } catch (exc) {
    console.log(exc.name + ` - Failed to execute ${func} with data:`, data)
  }
}

function formatMessage(txt) {
  return txt +
  '\n\n\n\n' + `*This bot is in BETA Phase. Everything runs on the testnet. Do not send real XLM!*` +
   '\n\n\n\n' +
    `[Deposit](https://www.reddit.com/user/stellar_bot/comments/7o2ex9/deposit/) | ` +
    `[Withdraw](https://np.reddit.com/message/compose/?to=${process.env.REDDIT_USER}&subject=Withdraw&message=Amount%20XLM%0Aaddress%20here) | ` +
    `[Balance](https://np.reddit.com/message/compose/?to=${process.env.REDDIT_USER}&subject=Balance&message=Tell%20me%20my%20XLM%20Balance!) | ` +
    `[Help](https://www.reddit.com/user/stellar_bot/comments/7o2gnd/help/) | ` +
    `[Donate](https://www.reddit.com/user/stellar_bot/comments/7o2ffl/donate/) | ` +
    `[About Stellar](https://www.stellar.org/)`
}

class Reddit extends Adapter {

  async sendDepositConfirmation (sourceAccount, amount) {
    await callReddit('composeMessage', {
      to: sourceAccount.uniqueId,
      subject: 'XLM Deposit',
      text: formatMessage(`Thank you. ${amount} XLM have been sucessfully deposited to your account.`)
    })
  }

  async onTipWithInsufficientBalance (tip, amount) {
    await callReddit('reply', formatMessage(`Sorry. I can not tip for you. Your balance is insufficient.`), tip.original)
  }

  async onTipTransferFailed(tip, amount) {
    await callReddit('reply', formatMessage(`Sorry. I can not tip for you. Your balance is insufficient.`), tip.original)
  }

  async onTipReferenceError (tip, amount) {
    await callReddit('reply', formatMessage(`Don't tip yourself please.`), tip.original)
  }

  async onTip (tip, amount) {
    console.log(`Tip from ${tip.sourceId} to ${tip.targetId}.`)
    await callReddit('reply', formatMessage(`Thank you. You tipped **${payment} XLM** to *${success.targetId}*.`), tip.original)
  }

  async onWithdrawalReferenceError (uniqueId, address, amount, hash) {
    console.log(`XML withdrawal failed - unknown error for ${uniqueId}.`)
    exeucte('composeMessage', {
      to: uniqueId,
      subject: 'XLM Withdrawal failed',
      text: formatMessage(`An unknown error occured. This shouldn't have happened. Please contact the bot.`)
    })
  }

  async onWithdrawalDestinationAccountDoesNotExist (uniqueId, address, amount, hash) {
    console.log(`XML withdrawal failed - no public address for ${uniqueId}.`)
    await callReddit('composeMessage', {
      to: uniqueId,
      subject: 'XLM Withdrawal failed',
      text: formatMessage(`We could not withdraw. The requested public address does not exist.`)
    })
  }

  async onWithdrawalFailedWithInsufficientBalance (uniqueId, address, amount, hash) {
    console.log(`XML withdrawal failed - insufficient balance for ${uniqueId}.`)
    await callReddit('composeMessage', {
      to: address,
      subject: 'XLM Withdrawal failed',
      text: formatMessage(`We could not withdraw. You requested more than your current balance. Please adjust and try again.`)
    })
  }

  async onWithdrawalInvalidAddress (uniqueId, address ,amount, hash) {
    console.log(`XML withdrawal failed - invalid address ${address}.`)
    await callReddit('composeMessage', {
      to: address,
      subject: 'XLM Withdrawal failed',
      text: formatMessage(`We could not withdraw. The given address is not valid.`)
    })
  }

  async onWithdrawalSubmissionFailed (uniqueId, address, amount, hash) {
    this.emit('withdrawalSubmissionFailed ', uniqueId, address, amount, hash)
  }

  async onWithdrawal (uniqueId, address, amount, hash) {
    await callReddit('composeMessage', {
      to: uniqueId,
      subject: 'XLM Withdrawal',
      text: formatMessage(`Thank's for your request. ${amount} XLM are on their way to ${address}.`)
    })
  }

  constructor (config) {
    super(config)

    console.log('Start observing subreddits ...')
    this.pollComments()

    console.log('Start observing reddit private messages ...')
    this.pollMessages()
  }

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
            adapter: 'reddit',
            sourceId: comment.author.name,
            targetId: targetComment.author.name,
            amount: tipAmount,
            original: comment
          })
        }
      }
    })

    lastBatch = comments
    await utils.sleep(2000)
    this.pollComments(lastBatch)
  }

  async pollMessages () {
    const messages = await callReddit('getUnreadMessages') || []
    let processedMessages = []

    await messages
      .filter(m => ['Withdraw', 'Balance'].indexOf(m.subject) > -1 && !m.was_comment)
      .forEach(async (m) => {
           // Check the balance of the user
        if (m.subject === 'Balance') {
          const balance = await this.requestBalance('reddit', m.author.name)
          await callReddit('composeMessage', {
            to: m.author.name,
            subject: 'XLM Balance',
            text: formatMessage(`Thank you. Your current balance is ${balance} XLM.`)
          })
          console.log(`Balance request answered for ${m.author.name}.`)
          await callReddit('markMessagesAsRead', [m])
        }

        if (m.subject === 'Withdraw') {
          const extract = this.extractWithdrawal(m.body_html)

          if (!extract) {
            console.log(`XML withdrawal failed - unparsable message from ${m.author.name}.`)
            await callReddit('composeMessage', {
              to: m.author.name,
              subject: 'XLM Withdrawal failed',
              text: formatMessage(`We could not withdraw. Please make sure that the first line of the body is withdrawal amount and the second line your public key.`)
            })
          } else {
              console.log(`XML withdrawal initiated for ${m.author.name}.`)
              await callReddit('markMessagesAsRead', [m])
              this.receiveWithdrawalRequest({
                adapter: 'reddit',
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

module.exports = Reddit