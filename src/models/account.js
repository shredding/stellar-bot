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

      withdraw: function (stellar, to, withdrawalAmount, hash) {
        const Transaction = db.models.transaction
        const account = this

        return new Promise(function (resolve, reject) {
          db.transaction(async function (err, t) {
            if (err) {
              reject(err)
            }

            if (!account.canPay) {
              throw new Error('Unsufficient balance. Always check with `canPay` before withdrawing money!')
            }

            const sourceBalance = new Big(account.balance)
            const amount = new Big(withdrawalAmount)
            account.balance = sourceBalance.minus(amount).toFixed(7)
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
              account.balance = refundBalance.plus(amount).toFixed(7)
              return reject('WITHDRAWAL_SUBMISSION_FAILED')
            }

            try {
              const tx = await stellar.createTransaction(to, withdrawalAmount.toFixed(7), hash)
              await stellar.send(tx)
            } catch (exc) {
              account.balance = refundBalance.plus(amount).toFixed(7)
              return reject(exc)
            }

            await Transaction.createAsync(doc)
            await account.saveAsync()

            t.commit((err) => {
              if (err) {
                console.log(err)
                return reject(err)
              }
              Transaction.events.emit('TRANSACTION_WITHDRAWAL')
                return resolve()
              })
          })
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
  Account.getOrCreate = function (adapter, uniqueId, doc) {
    return new Promise((resolve, reject) => {
      db.transaction(async function (err, t) {
        if (err) {
          reject(err)
        }
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

        t.commit((err) => {
          if (err) {
            reject(err)
          }
          resolve(a)
        })
      })
    })
  }

  return Account
}