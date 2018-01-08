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
      transfer: function (targetAccount, amount) {
        if (!this.canPay) {
          throw new Error('Unsufficient balance. Always check with `canPay` before tranferring money!')
        }

        const sourceAccount = this
        return new Promise(function (resolve, reject) {
          db.transaction(async function (err, t) {
            if (err) {
              reject(err)
            }

            const sourceBalance = new Big(sourceAccount.balance)
            const targetBalance = new Big(targetAccount.balance)
            amount = new Big(amount)

            sourceAccount.balance = sourceBalance.minus(amount).toFixed(7)
            targetAccount.balance = targetBalance.plus(amount).toFixed(7)

            await sourceAccount.saveAsync()
            await targetAccount.saveAsync()

            t.commit((err) => {
              if (err) {
                reject(err)
              }
              Account.events.emit('TRANSFER', sourceAccount, targetAccount, amount)
              resolve()
            })
          })
        })
      },

      /**
       * Transaction save deposit of a transaction
       */
      deposit: function (transaction) {
        const sourceAccount = this
        return new Promise(function (resolve, reject) {
          db.transaction(async function (err, t) {
            if (err) {
              reject(err)
            }

            const sourceBalance = new Big(sourceAccount.balance)
            amount = new Big(transaction.amount)

            sourceAccount.balance = sourceBalance.plus(amount).toFixed(7)
            transaction.credited = true

            await sourceAccount.saveAsync()
            await transaction.saveAsync()

            t.commit((err) => {
              if (err) {
                reject(err)
              }
              Account.events.emit('DEPOSIT', sourceAccount, amount)
              resolve()
            })
          })
        })
      },

      /**
       * Updates the account. You have to send the money afterwards!
       */
      withdraw: async function (amount) {
        if (!this.canPay) {
          throw new Error('Unsufficient balance. Always check with `canPay` before withdrawing money!')
        }
        const sourceBalance = new Big(this.balance)
        amount = new Big(amount)
        this.balance = sourceBalance.minus(amount).toFixed(7)
        await this.saveAsync()
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
  Account.getOrCreate = function (adapter, uniqueId, doc, newAccountCreatedCallback) {
    return new Promise((resolve, reject) => {
      db.transaction(async function (err, t) {
        if (err) {
          reject(err)
        }
        let account = await Account.oneAsync({ adapter, uniqueId })
        if (!account) {
          doc = doc || {}
          if (!doc.hasOwnProperty('adapter')) {
            doc.adapter = adapter
          }
          if (!doc.hasOwnProperty('uniqueId')) {
            doc.uniqueId = uniqueId
          }
          account = await Account.createAsync(doc)
          if(newAccountCreatedCallback) {
            newAccountCreatedCallback(uniqueId)
          }
        }

        t.commit((err) => {
          if (err) {
            reject(err)
          }
          resolve(account)
        })
      })
    })
  }

  return Account
}