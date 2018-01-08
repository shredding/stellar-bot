const orm = require('orm')
const Big = require('big.js')

module.exports = (db) => {

  const Account = db.define('account', {
      adapter: String,
      uniqueId: String,
      createdAt: String,
      updatedAt: String,
      balance: String
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
      transfer: async function (targetAccount, amount) {
        if (!this.canPay) {
          throw new Error('Unsufficient balance. Always check with `canPay` before tranferring money!')
        }

        return await Account.withinTransaction(async () => {
          const sourceBalance = new Big(this.balance)
          const targetBalance = new Big(targetAccount.balance)
          amount = new Big(amount)

          this.balance = sourceBalance.minus(amount).toFixed(7)
          targetAccount.balance = targetBalance.plus(amount).toFixed(7)

          await this.saveAsync()
          await targetAccount.saveAsync()
          Account.events.emit('TRANSFER', this, targetAccount, amount)
        })
      },

      /**
       * Transaction save deposit of a transaction
       */
      deposit: async function (transaction) {
        return await Account.withinTransaction(async () => {
          const sourceBalance = new Big(this.balance)
          amount = new Big(transaction.amount)

          this.balance = sourceBalance.plus(amount).toFixed(7)
          transaction.credited = true

          await this.saveAsync()
          await transaction.saveAsync()
          Account.events.emit('DEPOSIT', this, amount)
        })
      },

      withdraw: async function (stellar, to, withdrawalAmount, hash) {
        const Transaction = db.models.transaction
        const account = this

        return await Account.withinTransaction(async () => {
          if (!this.canPay) {
            throw new Error('Unsufficient balance. Always check with `canPay` before withdrawing money!')
          }
          const sourceBalance = new Big(this.balance)
          const amount = new Big(withdrawalAmount)
          this.balance = sourceBalance.minus(amount).toFixed(7)
          const refundBalance = new Big(account.balance)

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
          const exists = await Transaction.existsAsync({
            hash: hash,
            type: 'withdrawal',
            target: to
          })

          if (exists) {
            // Withdrawal already happened within a concurrent transaction, let's skip
            this.balance = refundBalance.plus(amount).toFixed(7)
            throw 'WITHDRAWAL_SUBMISSION_FAILED'
          }

          try {
            const tx = await stellar.createTransaction(to, withdrawalAmount.toFixed(7), hash)
            await stellar.send(tx)
          } catch (exc) {
            account.balance = refundBalance.plus(amount).toFixed(7)
            throw exc
          }

          await Transaction.createAsync(doc)
          await account.saveAsync()
        })
      }
    },

    hooks: {
      beforeSave: function () {
        const now = new Date()
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
      adapter : orm.enforce.required(),
      uniqueId : orm.enforce.required()
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

  Account.userExists = async function (adapter, uniqueId) {
    return await Account.withinTransaction(async () => {
      let a = await Account.oneAsync({ adapter, uniqueId })
      return a != null
    })
  }

  return Account
}