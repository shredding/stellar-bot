const orm = require('orm')
const Big = require('big.js')
const StellarSdk = require('stellar-sdk')
const Promise = require('../../node_modules/bluebird')

module.exports = (db) => {

  /**
   * A user account.
   *
   * For performance reasons, this is not connected to the transaction.
   *
   * However, all balance updates are transaction save and a refund strategy is available
   * even if horizon fails.
   */
  const Account = db.define('account', {
      adapter: String,
      uniqueId: String,
      createdAt: String,
      updatedAt: String,
      balance: String,
      walletAddress: String // THIS IS A PUBLIC KEY, NOT THE SECRET KEY. DO NOT STORE USERS' SECRET KEYS EVER
    }, {

    methods: {
      /**
       * Checks if the account has sufficient balance.
       */
      canPay: function (required) {
        const balance = new Big(this.balance)
        required = new Big(required)
        return balance.gte(required)
      },

      /**
       * Transfers money to the target account.
       *
       * Transaction save.
       */
      transfer: async function (targetAccount, amount, hash) {
        if (!this.canPay(amount)) {
          throw new Error('Unsufficient balance. Always check with `canPay` before transferring money!')
        }

        return await Account.withinTransaction(async () => {
          const Action = db.models.action
          const sourceBalance = new Big(this.balance)
          const targetBalance = new Big(targetAccount.balance)

          amount = new Big(amount)
          this.balance = sourceBalance.minus(amount).toFixed(7)
          targetAccount.balance = targetBalance.plus(amount).toFixed(7)

          const exists = await Action.existsAsync({
            hash: hash,
            sourceaccount_id: this.id,
            type: 'transfer'
          })

          if (exists) {
            throw new 'DUPLICATE_TRANSFER'
          }
          await this.saveAsync()
          await targetAccount.saveAsync()
          await Action.createAsync({
            amount: amount.toFixed(7),
            type: 'transfer',
            sourceaccount_id: this.id,
            targetaccount_id: targetAccount.id,
            hash: hash
          })
          Account.events.emit('TRANSFER', this, targetAccount, amount)
        })
      },

      /**
       * Transaction save deposit of a transaction
       */
      deposit: async function (transaction) {
        return await Account.withinTransaction(async () => {
          const Action = db.models.action

          const exists = await Action.existsAsync({
            hash: transaction.hash,
            sourceaccount_id: this.id,
            type: 'deposit'
          })

          if (exists) {
            throw 'DUPLICATE_DEPOSIT'
          }
          const sourceBalance = new Big(this.balance)
          amount = new Big(transaction.amount)

          this.balance = sourceBalance.plus(amount).toFixed(7)
          transaction.credited = true

          await this.saveAsync()
          await transaction.saveAsync()
          const action = await Action.createAsync({
            amount: amount.toFixed(7),
            type: 'deposit',
            sourceaccount_id: this.id,
            hash: transaction.hash
          })
          Account.events.emit('DEPOSIT', this, amount)
        })
      },

      /**
       * Withdraw money from the main account to the requested account by the user.
       *
       * You can get the stellar object from the adapter config.
       *
       * to should be a public address
       * withdrawalAmount can be a string or a Big
       * hash should just be something unique - we use the msg id from reddit,
       * but a uuid4 or sth like that would work as well.
       */
      withdraw: async function (stellar, to, withdrawalAmount, hash) {
        const Transaction = db.models.transaction
        const Action = db.models.action

        return await Account.withinTransaction(async () => {
          if (!this.canPay(withdrawalAmount)) {
            throw new Error('Unsufficient balance. Always check with `canPay` before withdrawing money!')
          }
          const sourceBalance = new Big(this.balance)
          const amount = new Big(withdrawalAmount)
          this.balance = sourceBalance.minus(amount).toFixed(7)
          const refundBalance = new Big(this.balance)

          const now = new Date()
          const doc = {
            memoId: 'XLM Tipping bot',
            amount: amount.toFixed(7),
            createdAt: now.toISOString(),
            asset: 'native',
            source: stellar.address,
            target: to,
            hash: hash,
            type: 'withdrawal'
          }
          const txExists = await Transaction.existsAsync({
            hash: hash,
            type: 'withdrawal',
            target: to
          })

          if (txExists) {
            // Withdrawal already happened within a concurrent transaction, let's skip
            this.balance = refundBalance.plus(amount).toFixed(7)
            throw 'DUPLICATE_WITHDRAWAL'
          }

          try {
            const tx = await stellar.createTransaction(to, withdrawalAmount.toFixed(7), hash)
            await stellar.send(tx)
          } catch (exc) {
            this.balance = refundBalance.plus(amount).toFixed(7)
            throw exc
          }

          await this.saveAsync()
          await Transaction.createAsync(doc)
          await Action.createAsync({
            hash: hash,
            type: 'withdrawal',
            sourceaccount_id: this.id,
            amount: amount.toFixed(7),
            address: to
          })
        })
      },

      setWalletAddress: async function (newAddress) {
        this.walletAddress = newAddress
        await this.saveAsync().catch(e => {
          console.error(`Error while setting public wallet address of Account object:\nNewAddress: ${newAddress}\nlException:${JSON.stringify(e)}`)
          return Promise.reject(e)
        })
      }
    },

    hooks: {
      beforeSave: function () {
        const now = new Date()

        // If our walletAddress is set, we need to make sure it's a valid wallet address before saving
        if(typeof this.walletAddress !== 'undefined' && this.walletAddress !== null) {
          if(!StellarSdk.StrKey.isValidEd25519PublicKey(this.walletAddress)) {
            this.walletAddress = null
            return Promise.reject(new Error('BAD_PUBLIC_WALLET_ADDRESS'))
          }
        }

        if (!this.createdAt) {
          this.createdAt = now.toISOString()
        }
        if (!this.balance) {
          this.balance = '0.0000000'
        }
        this.updatedAt = now.toISOString()
      }
    },

    validations : {
      adapter : orm.enforce.required('adapter is required'),
      uniqueId : orm.enforce.required('uniqueId is required'),
      walletAddress : orm.enforce.unique(`Can't register the same wallet for two different users`),
    }
  })

  /**
   * Transaction save get or create.
   * doc if optional (adapter and uniqueId are taken if not given)
   */
  Account.getOrCreate = async function (adapter, uniqueId, doc) {
    return await Account.withinTransaction(async () => {
      let a = await Account.oneAsync({ adapter, uniqueId })
      if (!a) {
        doc = doc || {}
        if (!doc.hasOwnProperty('adapter')) {
          doc.adapter = adapter
        }
        if (!doc.hasOwnProperty('uniqueId')) {
          doc.uniqueId = uniqueId
        }
        a = await Account.createAsync(doc)
      }
      return a
    })
  }

  Account.walletAddressForUser = async function (adapter, uniqueId) {
    return await Account.withinTransaction(async () => {
      let a = await Account.oneAsync({ adapter, uniqueId })
      if (a && a.walletAddress && StellarSdk.StrKey.isValidEd25519PublicKey(a.walletAddress)) {
        return a.walletAddress
      } else {
        return null
      }
    })
  }

  return Account
}
