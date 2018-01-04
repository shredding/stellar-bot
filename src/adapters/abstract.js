const utils = require('../utils')
const Big = require('big.js')

class Adapter {

  constructor (config) {
    this.config = config

    this.Account = config.models.account

    this.Account.events.on('TRANSFER', this.onTransfer)
    this.Account.events.on('DEPOSIT', this.onDeposit)

    this.TIPP_STATUS_DO_NOTHING = 'TIPP_STATUS_DO_NOTHING'
    this.TIPP_STATUS_INSUFFICIENT_BALANCE = 'TIPP_STATUS_INSUFFICIENT_BALANCE'
    this.TIPP_STATUS_TRANSFER_FAILED = 'TIPP_STATUS_TRANSFER_FAILED'
    this.TIPP_STATUS_TIPPED = 'TIPP_STATUS_TIPPED'
    this.TIPP_STATUS_REFERENCE_ERROR = 'TIPP_STATUS_REFERENCE_ERROR'

    this.WITHDRAWAL_STATUS_INSUFFICIENT_BALANCE = 'WITHDRAWAL_STATUS_INSUFFICIENT_BALANCE'
    this.WITHDRAWAL_STATUS_SUCCESS = 'WITHDRAWAL_STATUS_SUCCESS'
    this.WITHDRAWAL_STATUS_DESTINATION_ACCOUNT_DOES_NOT_EXIST = 'WITHDRAWAL_STATUS_DESTINATION_ACCOUNT_DOES_NOT_EXIST'
    this.WITHDRAWAL_STATUS_SUBMISSION_FAILED = 'WITHDRAWAL_STATUS_SUBMISSION_FAILED'
    this.WITHDRAWAL_STATUS_REFERENECE_ERROR = 'WITHDRAWAL_STATUS_REFERENECE_ERROR'

  }

  onTransfer (sourceAccount, targetAccount, amount) {
    // Hook function
  }

  onDeposit (sourceAccount, amount) {
    // Hook
  }

  /**
   *  Should receive a tip object like:
   *
   *  {
   *    text: "the text to scan",
   *    adapter: "adapter_name", (e.g. "reddit")
   *    sourceId: "unique_source_id", (e.g. reddit username)
   *    resolveTargetId: async function that finally resolves the target id
   *  }
   */
  receivePotentialTip (tip) {
    return new Promise(async (resolve, reject) => {

      // Check if the text does contain a tip.
      const payment = utils.extractPayment(tip.text)
      if (!payment) {
        return reject(this.TIPP_STATUS_DO_NOTHING)
      }

      // Let's see if the source has a sufficient balance
      const source = await this.Account.getOrCreate(tip.adapter, tip.sourceId)
      if (!source.canPay(payment)) {
        return reject(this.TIPP_STATUS_INSUFFICIENT_BALANCE)
      }

      // Fetch or create the recipient
      const targetId = await tip.resolveTargetId()

      if (tip.sourceId === targetId) {
        return reject(this.TIPP_STATUS_REFERENCE_ERROR)
      }

      const target = await this.Account.getOrCreate(tip.adapter, targetId)

      // ... and tip.
      source.transfer(target, payment)
        .then(() => resolve({status: this.TIPP_STATUS_TIPPED, targetId: targetId, amount: payment.toFixed(7)}))
        .catch(() => reject(this.TIPP_STATUS_TRANSFER_FAILED))
    })
  }

  requestBalance (adapter, uniqueId) {
    return new Promise(async (resolve, reject) => {
      const target = await this.Account.getOrCreate(adapter, uniqueId)
      resolve(target.balance)
    })
  }

  /**
   * Extract should be the result of utils.extractWithdrawal
   *
   * Hash should be a unique id (e.g. the message id)
   */
  receiveWithdrawalRequest (adapter, uniqueId, extract, hash) {
    return new Promise(async (resolve, reject) => {

      const withdrawalAmount = new Big(extract.amount)

      // Fetch the account
      const target = await this.Account.getOrCreate(adapter, uniqueId)
      if (!target.canPay(withdrawalAmount)) {
        return reject(this.WITHDRAWAL_STATUS_INSUFFICIENT_BALANCE)
      }

      // Update it's balance
      await target.withdraw(withdrawalAmount)

      // ... and commit the withdrawal to the network
      this.config.stellar.send(extract.address, withdrawalAmount.toFixed(7), hash)
        .then(resolve)
        .catch(reject)
    })
  }
}

module.exports = Adapter