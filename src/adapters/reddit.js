const Snoowrap = require('snoowrap')
const Snoostorm = require('snoostorm')
const Adapter = require('./abstract')
const utils = require('../utils')

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
    if (data) {
      return client[func](data)
    } else {
      return client[func](data)
    }
  } catch (exc) {
    console.log(`Failed to execute ${func} with data:`)
    console.log(data)
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

  onDeposit (sourceAccount, amount) {
    callReddit('composeMessage', {
      to: sourceAccount.uniqueId,
      subject: 'XLM Deposit',
      text: formatMessage(`Thank you. ${amount} XLM have been sucessfully deposited to your account.`)
    })
  }

  constructor (config) {
    super(config)

    const r = getR()
    const client = new Snoostorm(r)

    // +++ Looking for tips
    const streamOpts = {
        subreddit: 'Stellar',
        results: 25
    }

    const comments = client.CommentStream(streamOpts)

    console.log('Start observing subreddits ...')
    comments.on('comment', (comment) => {
      const potentialTip = {
        adapter: 'reddit',
        sourceId: comment.author.name,
        text: comment.body,
        resolveTargetId: async () => {
           const targetComment = await callReddit('getComment', comment.parent_id).fetch()
           return targetComment.author.name
        }
      }
      this.receivePotentialTip(potentialTip)
        // +++ A successful tip has been made
        .then((success) => {
          console.log(`Tip from ${potentialTip.sourceId} to ${success.targetId}.`)
          callReddit('reply', formatMessage(`Thank you. You tipped **${success.amount} XLM** to *${success.targetId}*.`), comment)
        })
        // ++ The tip has been rejected
        .catch((status) => {
          switch (status) {
            case this.TIPP_STATUS_DO_NOTHING:
              break;

            case this.TIPP_STATUS_INSUFFICIENT_BALANCE:
              callReddit('reply', formatMessage(`Sorry. I can not tip for you. Your balance is insufficient.`), comment)
              break;

            case this.TIPP_STATUS_TRANSFER_FAILED:
              callReddit('reply', formatMessage(`I messed up, sorry. A developer will look into this. Your balance hasn't been touched.`), comment)
              break;

            case this.TIPP_STATUS_REFERENCE_ERROR:
              callReddit('reply', formatMessage(`Don't tip yourself please.`), comment)

            default:
              callReddit('reply', formatMessage(`An unknown error occured. This shouldn't have happened. Please contact the bot.`), comment)
              break;
          }
      })
    })

    console.log('Start observing reddit private messages ...')
    this.pollMessages()
  }

  async pollMessages () {
    const messages = await callReddit('getUnreadMessages')
    let processedMessages = []

    await messages
      .filter(m => ['Withdraw', 'Balance'].indexOf(m.subject) > -1 && !m.was_comment)
      .forEach(async (m) => {
           // Check the balance of the user
        if (m.subject === 'Balance') {
          const balance = await this.requestBalance('reddit', m.author.name)
          callReddit('composeMessage', {
            to: m.author.name,
            subject: 'XLM Balance',
            text: formatMessage(`Thank you. Your current balance is ${balance} XLM.`)
          })
          console.log(`Balance request answered for ${m.author.name}.`)
          callReddit('markMessagesAsRead', [m])
        }

        if (m.subject === 'Withdraw') {
          const extract = utils.extractWithdrawal(m.body_html)

          if (!extract) {
            console.log(`XML withdrawal failed - unparsable message from ${m.author.name}.`)
            callReddit('composeMessage', {
              to: m.author.name,
              subject: 'XLM Withdrawal failed',
              text: formatMessage(`We could not withdraw. Please make sure that the first line of the body is withdrawal amount and the second line your public key.`)
            })
            callReddit('markMessagesAsRead', [m])
          } else {
            try {
              console.log(`XML withdrawal initiated for ${m.author.name}.`)
              callReddit('markMessagesAsRead', [m])
              await this.receiveWithdrawalRequest('reddit', m.author.name, extract, m.id)
              callReddit('composeMessage', {
                to: m.author.name,
                subject: 'XLM Withdrawal',
                text: formatMessage(`Thank's for your request. ${extract.amount.toFixed(7)} XLM are on their way to ${extract.address}.`)
              })
            } catch (exc) {
              switch (exc) {
                case this.WITHDRAWAL_STATUS_INSUFFICIENT_BALANCE:
                  console.log(`XML withdrawal failed - insufficient balance for ${m.author.name}.`)
                  callReddit('composeMessage', {
                    to: m.author.name,
                    subject: 'XLM Withdrawal failed',
                    text: formatMessage(`We could not withdraw. You requested more than your current balance. Please adjust and try again.`)
                  })
                  break
                case this.WITHDRAWAL_STATUS_DESTINATION_ACCOUNT_DOES_NOT_EXIST:
                  console.log(`XML withdrawal failed - no public address for ${m.author.name}.`)
                  callReddit('composeMessage', {
                    to: m.author.name,
                    subject: 'XLM Withdrawal failed',
                    text: formatMessage(`We could not withdraw. The requested public address does not exist.`)
                  })
                  break
                default:
                  console.log(`XML withdrawal failed - unknown error for ${m.author.name}.`)
                  exeucte('composeMessage', {
                    to: m.author.name,
                    subject: 'XLM Withdrawal failed',
                    text: formatMessage(`An unknown error occured. This shouldn't have happened. Please contact the bot.`)
                  })
                  break;
              }
            }
            callReddit('markMessagesAsRead', [m])
          }
        }
    })

    await utils.sleep(2000)
    return this.pollMessages()
  }

}

module.exports = Reddit