const orm = require('orm')
const Big = require('big.js')


module.exports = (db) => {

  /**
   * A stellar network transaction
   */
  const Transaction = db.define('transaction', {
      source: String,
      target: String,
      cursor: String,
      memoId: String,
      type: ['deposit', 'withdrawal'],
      createdAt: String,
      amount: String,
      asset: String,
      hash: String,
      credited: Boolean
    }, {
    validations : {
      source : orm.enforce.required(),
      target : orm.enforce.required(),
      type : orm.enforce.required(),
      amount : orm.enforce.required(),
      createdAt: orm.enforce.required(),
      hash: [orm.enforce.unique('Hash already exists.'), orm.enforce.required()]
    },
    hooks: {
      beforeSave: function () {
        if (!this.credited) {
          this.credited = false
        }
      },
      afterSave: function (success) {
        if (success && !this.credited && this.type === 'deposit') {
          const Account = db.models.account

          if (this.memoId) {
            const accountParts = this.memoId.replace(/\s/g, '').split('/')
            if (accountParts.length === 2) {
              const adapter = accountParts[0]
              const uniqueId = accountParts[1]

              account = Account.getOrCreate(adapter, uniqueId).then(async (acc) => {
                await acc.deposit(this)
              })
            }
          }
        }
      }
    },
  })

  Transaction.latest = function () {
    return new Promise((resolve, reject) => {
      this.find({type: 'deposit'}).order('-createdAt').run((err, results) => {
        if (err) {
          reject(err)
        }
        resolve(results[0])
      })
    })
  }

  return Transaction
}