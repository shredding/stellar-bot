const assert = require('assert')


describe('models / account', async () => {

  let Model;
  let account;

  beforeEach(async () => {
    const config = await require('./setup')()
    Model = config.models.account
    account = await Model.createAsync({
      adapter: 'testing',
      uniqueId: 'foo',
      balance: '1.0000000'
    })
  })

  describe('getOrCreate', () => {
    it ('should only create a new account if it does not already exist', async () => {
      const sameAccount = await Model.getOrCreate('testing', 'foo')
      assert.equal(account._id, sameAccount._id)

      const otherAccount = await Model.getOrCreate('testing', 'bar', {
        balance: '5.0000000'
      })
      assert.equal(otherAccount.adapter, 'testing')
      assert.equal(otherAccount.uniqueId, 'bar')
      assert.equal(otherAccount.balance, '5.0000000')
    })
  })

  describe('withdraw', () => {
    it ('can withdraw money', async () => {
      const acc = await Model.getOrCreate('testing', 'foo')
      await acc.withdraw('0.40000000')
      assert.equal(acc.balance, '0.6000000')
      const accReloaded = await Model.getOrCreate('testing', 'foo')
      assert.equal(accReloaded.balance, '0.6000000')
    })
  })

  describe('canPay', () => {
    it ('should return true if balance is gte', () => {
      assert.ok(account.canPay('1'))
      assert.ok(account.canPay('0.65'))
    })

    it ('should return false if balance is lte', () => {
      assert.ok(!account.canPay('2'))
    })
  })
})
