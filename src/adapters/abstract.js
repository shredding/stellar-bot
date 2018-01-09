const utils = require('../utils')
const Big = require('big.js')
const StellarSdk = require('stellar-sdk')
const EventEmitter = require('events')

class Adapter extends EventEmitter {

  constructor (config) {
    super()

    this.config = config

    this.Account = config.models.account

    this.Account.events.on('DEPOSIT', (sourceAccount, amount) => {
      if (this.name === sourceAccount.adapter) {
        this.onDeposit(sourceAccount, amount.toFixed(7))
      }
    })
  }

  // *** +++ Deposit Hook Functions +
  async onDeposit (sourceAccount, amount) {
    // Override this or listen to events!
    this.emit('deposit', sourceAccount, amount)
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

  async onTip (potentialTip, amount) {
    // Override this or listen to events!
    this.emit('tip', potentialTip, amount)
  }

  // *** +++ Withdrawael Hook Functions +
  async onWithdrawalReferenceError (uniqueId, address, amount, hash) {
    // Override this or listen to events!
    this.emit('withdrawalReferenceError', uniqueId, address, amount, hash)
  }

  async onWithdrawalDestinationAccountDoesNotExist (uniqueId, address, amount, hash) {
    // Override this or listen to events!
    this.emit('withdrawalDestinationAccountDoesNotExist', uniqueId, address, amount, hash)
  }

  async onWithdrawalFailedWithInsufficientBalance (uniqueId, address, amount, hash) {
    // Override this or listen to events!
    this.emit('withdrawalFailedWithInsufficientBalance', uniqueId, address, amount, hash)
  }

  async onWithdrawalSubmissionFailed (uniqueId, address, amount, hash) {
    // Override this or listen to events!
    this.emit('withdrawalSubmissionFailed', uniqueId, address, amount, hash)
  }

  async onWithdrawalInvalidAddress (uniqueId, address ,amount, hash) {
    // Override this or listen to events!
   this.emit('withdrawalInvalidAddress', uniqueId, address, amount, hash)
  }

  async onWithdrawal (uniqueId, address, amount, hash) {
    // Override this or listen to events!
    this.emit('withdrawal', uniqueId, address, amount, hash)
  }

  /**
   *  Should receive a tip object like:
   *
   *  {
   *    adapter: "adapter_name", (e.g. "reddit")
   *    sourceId: "unique_source_id", (e.g. reddit username)
   *    targetId: "foo_bar" // the target id
   *    amount: "123.12",,
   *    hash: "asfcewef" // some kind of hash, e.g. comment hash, must be unique per sourceId
   *  }
   *
   *  You'll receive the tip object within every hook, so you can add stuff you need in the callbacks
   */
  async receivePotentialTip (tip) {
      // Let's see if the source has a sufficient balance
      const source = await this.Account.getOrCreate(tip.adapter, tip.sourceId)
      const payment = new Big(tip.amount)
      const hash = tip.hash

      if (!source.canPay(payment)) {
        return this.onTipWithInsufficientBalance(tip, payment.toFixed(7))
      }

      if (tip.sourceId === tip.targetId) {
        return this.onTipReferenceError(tip, payment.toFixed(7))
      }

      const target = await this.Account.getOrCreate(tip.adapter, tip.targetId)

      // ... and tip.
      source.transfer(target, payment, hash)
        .then(() => {
          this.onTip(tip, payment.toFixed(7))
        })
        .catch((exc) => {
          if (exc !== 'DUPLICATE_TRANSFER') {
            this.onTipTransferFailed(tip, payment.toFixed(7))
          }
        })
  }

  /**
   * Returns the balance for the requested adapter / uniqueId combination.
   *
   * A fresh account with an initial balance of zero is created if it does not exist.
   */
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
   *
   * Should receive an object like this:
   *
   * {
   *     adapter: 'reddit',
   *     uniqueId: 'the-dark-coder'
   *     address: 'aStellarAddress',
   *     amount: '12.12'
   *     hash: 'aUniqueHash'
   * }
   */
  async receiveWithdrawalRequest (withdrawalRequest) {
    const withdrawalAmount = new Big(withdrawalRequest.amount)
    const adapter = withdrawalRequest.adapter
    const uniqueId = withdrawalRequest.uniqueId
    const hash = withdrawalRequest.hash
    const address = withdrawalRequest.address
    const fixedAmount = withdrawalAmount.toFixed(7)

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
      return this.onWithdrawalInvalidAddress(uniqueId, address, fixedAmount, hash)
    }

    // Fetch the account
    const target = await this.Account.getOrCreate(adapter, uniqueId)
    if (!target.canPay(withdrawalAmount)) {
      return this.onWithdrawalFailedWithInsufficientBalance(uniqueId, address, fixedAmount, hash)
    }

    // Withdraw
    try {
      await target.withdraw(this.config.stellar, address, withdrawalAmount, hash)
      this.onWithdrawal(uniqueId, address, fixedAmount, hash)
    } catch (exc) {
      if (exc === 'WITHDRAWAL_DESTINATION_ACCOUNT_DOES_NOT_EXIST') {
        return this.onWithdrawalDestinationAccountDoesNotExist(uniqueId, address, fixedAmount, hash)
      }
      if (exc === 'WITHDRAWAL_REFERENCE_ERROR') {
        return this.onWithdrawalReferenceError(uniqueId, address, fixedAmount, hash)
      }
      if (exc === 'WITHDRAWAL_SUBMISSION_FAILED') {
        return this.onWithdrawalSubmissionFailed(uniqueId, address, fixedAmount, hash)
      }
    }
  }
}

module.exports = Adapter