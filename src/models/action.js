const orm = require('orm')
const Big = require('big.js')

module.exports = (db) => {

  /**
   * A generic action
   */
  const Action = db.define('action', {
      type: ['withdrawal', 'deposit', 'transfer'],
      amount: String,
      address: String,
      hash: String,
      createdAt: String
    }, {
    validations : {
      type: orm.enforce.required('Type is required.'),
      amount: orm.enforce.required('Amount is required.'),
      hash: orm.enforce.required('Hash is required.'),
      createdAt: orm.enforce.required('createdAt is required.')
    },
    hooks: {
      beforeSave: function () {
        const now = new Date()
        if (!this.createdAt) {
          this.createdAt = now.toISOString()
        }
      }
    }
  })

  Action.hasOne('sourceAccount', db.models.account, { required: true, reverse: 'sourceActions' })
  Action.hasOne('targetAccount', db.models.account, { reverse: 'targetActions' })

  return Action
}