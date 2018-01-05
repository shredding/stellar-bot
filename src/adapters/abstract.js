const utils = require('../utils')
const Big = require('big.js')
const EventEmitter = require('events')

class Adapter extends EventEmitter {

  constructor (config) {
    super()

    this.config = config

    this.Account = config.models.account

    this.Account.events.on('TRANSFER', this.onTransfer)
    this.Account.events.on('DEPOSIT', this.onDeposit)

    this.WITHDRAWAL_STATUS_INSUFFICIENT_BALANCE = 'WITHDRAWAL_STATUS_INSUFFICIENT_BALANCE'
    this.WITHDRAWAL_STATUS_SUCCESS = 'WITHDRAWAL_STATUS_SUCCESS'
    this.WITHDRAWAL_STATUS_DESTINATION_ACCOUNT_DOES_NOT_EXIST = 'WITHDRAWAL_STATUS_DESTINATION_ACCOUNT_DOES_NOT_EXIST'
    this.WITHDRAWAL_STATUS_SUBMISSION_FAILED = 'WITHDRAWAL_STATUS_SUBMISSION_FAILED'
    this.WITHDRAWAL_STATUS_REFERENECE_ERROR = 'WITHDRAWAL_STATUS_REFERENECE_ERROR'

  }

  async onTransfer (sourceAccount, targetAccount, amount) {
    // Override this or listen to events!
    this.emit('transfer', sourceAccount, targetAccount, amount)
  }

  async onDeposit (sourceAccount, amount) {
    // Override this or listen to events!
    this.emit('deposit', sourceAccount, amount)
  }

  async onNoPotentialTip (potentialTip) {
    // Override this or listen to events!
    this.emit('noPotentialTip', potentialTip)
  }

  async onTipWithInsufficientBalance (potentialTip, amount) {
    // Override this or listen to events!
    this.emit('tipWithInsufficientBalance', potentialTip, amount)
  }

  async onTipTransferFailed (potentialTip, amount) {
    // Override this or listen to events!
    this.emit('tipTransferFailed', potentialTip, amount)
  }

  async onTipReferenceError (potentialTip, amount) {
    // Override this or listen to events!
    this.emit('tipReferenceError', potentialTip, amount)
  }

  async onTip (potentialTip, amount, resolvedTargetId) {
    // Override this or listen to events!
    this.emit('tip', potentialTip, amount, resolvedTargetId)
  }

  /**
   *  Should receive a tip object like:
   *
   *  {
   *    text: "the text to scan",
   *    adapter: "adapter_name", (e.g. "reddit")
   *    sourceId: "unique_source_id", (e.g. reddit username)
   *    targetId: "foo_bar" // the target id
   *    resolveTargetId: async function that finally resolves the target id if you don't have it (optional)
   *  }
   *
   *  You'll receive the tip object within every hook, so you can add stuff you need in the callbacks
   */
  async receivePotentialTip (tip) {
      // Check if the text does contain a tip.
      const payment = utils.extractPayment(tip.text)
      if (!payment) {
        return this.onNoPotentialTip(tip)
      }

      // Let's see if the source has a sufficient balance
      const source = await this.Account.getOrCreate(tip.adapter, tip.sourceId)
      if (!source.canPay(payment)) {
        return this.onTipWithInsufficientBalance(tip, payment.toFixed(7))
      }

      // Fetch or create the recipient
      const targetId = tip.targetId ? tip.targetId : await tip.resolveTargetId()

      if (!targetId) {
        return this.onTipTransferFailed(tip, payment.toFixed(7))
      }
      if (tip.sourceId === targetId) {
        return this.onTipReferenceError(tip, payment.toFixed(7))
      }

      const target = await this.Account.getOrCreate(tip.adapter, targetId)

      // ... and tip.
      source.transfer(target, payment)
        .then(() => {
          this.onTip(tip, payment.toFixed(7), targetId)
        })
        .catch(() => {
          this.onTipTransferFailed(tip, payment.toFixed(7))
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