const utils = require('../utils')
const Big = require('big.js')
const StellarSdk = require('stellar-sdk')
const EventEmitter = require('events')

class Adapter extends EventEmitter {

  constructor (config) {
    super()

    this.config = config

    this.Account = config.models.account

    this.Account.events.on('TRANSFER', this.onTransfer)
    this.Account.events.on('DEPOSIT', this.onDeposit)
  }

  // *** +++ Transfer Hook Functions +
  async onTransfer (sourceAccount, targetAccount, amount) {
    // Override this or listen to events!
    this.emit('transfer', sourceAccount, targetAccount, amount)
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
    this.emit('withdrawalReferenceError', uniqueId, address, amount, hash)
  }

  async onWithdrawalDestinationAccountDoesNotExist (uniqueId, address, amount, hash) {
    this.emit('withdrawalDestinationAccountDoesNotExist', uniqueId, address, amount, hash)
  }

  async onWithdrawalFailedWithInsufficientBalance (uniqueId, address, amount, hash) {
    this.emit('withdrawalFailedWithInsufficientBalance', uniqueId, address, amount, hash)
  }

  async onWithdrawalSubmissionFailed (uniqueId, address, amount, hash) {
    this.emit('withdrawalSubmissionFailed ', uniqueId, address, amount, hash)
  }

  async onWithdrawalInvalidAddress (uniqueId, address ,amount, hash) {
   this.emit('withdrawalInvalidAddress', uniqueId, address, amount, hash)
  }

  async onWithdrawal (uniqueId, address, amount, hash) {
    this.emit('withdrawal', uniqueId, address, amount, hash)
  }

  async sendDepositConfirmation (sourceAccount, amount) {
      // Override me
  }

  async sendTransferConfirmation (sourceAccount, amount) {
      // Override me
  }

    /**
     * // Being that each platform (Reddit, Twitter, Slack...) can have different
     * means of initiating the tipping process, and may even have multiple,
     * each adapter is responsible for handling the extraction of the tip amount
     * from users' commands.
     * @param tipText The original command given by the tipbot user
     */
  // extractTipAmount (tipText) {
  //   // Override me
  //     console.error("Abstract extractTipAmount() should not get called")
  //     return undefined
  // }

  /**
   *  Should receive a tip object like:
   *
   *  {
   *    adapter: "adapter_name", (e.g. "reddit")
   *    sourceId: "unique_source_id", (e.g. reddit username)
   *    targetId: "foo_bar" // the target id
   *    amount: "123.12",
   *  }
   *
   *  You'll receive the tip object within every hook, so you can add stuff you need in the callbacks
   */
  async receivePotentialTip (tip) {
      // Let's see if the source has a sufficient balance
      const source = await this.Account.getOrCreate(tip.adapter, tip.sourceId)
      const payment = new Big(tip.amount)

      if (!source.canPay(payment)) {
        return this.onTipWithInsufficientBalance(tip, payment.toFixed(7))
      }

      if (tip.sourceId === tip.targetId) {
        return this.onTipReferenceError(tip, payment.toFixed(7))
      }

      const target = await this.Account.getOrCreate(tip.adapter, tip.targetId)

      // ... and tip.
      source.transfer(target, payment)
        .then(() => {
          this.onTip(tip, payment.toFixed(7))
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
  receiveWithdrawalRequest (withdrawalRequest) {
    return new Promise(async (resolve, reject) => {

      const withdrawalAmount = new Big(withdrawalRequest.amount)
      const adapter = withdrawalRequest.adapter
      const uniqueId = withdrawalRequest.uniqueId
      const hash = withdrawalRequest.hash
      const address = withdrawalRequest.address

      if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
        return this.onWithdrawalInvalidAddress(uniqueId, address, withdrawalAmount.toFixed(7), hash)
      }

      // Fetch the account
      const target = await this.Account.getOrCreate(adapter, uniqueId)
      if (!target.canPay(withdrawalAmount)) {
        return this.onWithdrawalFailedWithInsufficientBalance(uniqueId, address, withdrawalAmount.toFixed(7), hash)
      }

      // Update it's balance
      await target.withdraw(withdrawalAmount)

      // ... and commit the withdrawal to the network
      this.config.stellar.send(address, withdrawalAmount.toFixed(7), hash)
        .then(() => {
          this.onWithdrawal(uniqueId, address, withdrawalAmount.toFixed(7), hash)
        })
        .catch((data) => {
          switch (data.status) {
            case 'WITHDRAWAL_REFERENCE_ERROR':
              this.onWithdrawalReferenceError(uniqueId, address, withdrawalAmount.toFixed(7), hash)
              break
            case 'WITHDRAWAL_DESTINATION_ACCOUNT_DOES_NOT_EXIST':
              this.onWithdrawalDestinationAccountDoesNotExist(uniqueId, address, withdrawalAmount.toFixed(7), hash)
              break

            default:
              this.onWithdrawalSubmissionFailed(uniqueId, address, withdrawalAmount.toFixed(7), hash)
              break
          }
        })
    })
  }
}

module.exports = Adapter