const assert = require('assert')


describe('models / account', async () => {

  let Account
  let Transaction
  let Action
  let account

  beforeEach(async () => {
    const config = await require('./setup')()
    Account = config.models.account
    Transaction = config.models.transaction
    Action = config.models.action

    account = await Account.createAsync({
      adapter: 'testing',
      uniqueId: 'foo',
      balance: '1.0000000'
    })
  })

  describe('deposit', () => {
    it ('should deposit on the account and create action', async () => {
      const tx = await Transaction.createAsync({
            memoId: 'testing/foo',
            amount: '5.0000000',
            createdAt: new Date('2018-01-01'),
            asset: 'native',
            cursor: 'token',
            source: 'source',
            target: 'target',
            hash: 'hash',
            type: 'deposit'
      })
      await account.deposit(tx)

      const reloaded = await Account.getOrCreate('testing', 'foo')
      const action = await Action.oneAsync({hash: 'hash', type: 'deposit', sourceaccount_id: reloaded.id})

      assert.equal(reloaded.balance, '6.0000000')
      assert.equal(action.amount, '5.0000000')
    })

    it ('should not deposit on the account if action exists', async () => {
      const tx = await Transaction.createAsync({
            memoId: 'testing/foo',
            amount: '1.0000000',
            createdAt: new Date('2018-01-01'),
            asset: 'native',
            cursor: 'token',
            source: 'source',
            target: 'target',
            hash: 'hash',
            type: 'deposit'
      })
      await Action.createAsync({
        amount: '1.0000000',
        type: 'deposit',
        sourceaccount_id: account.id,
        hash: 'hash'
      })
      await account.deposit(tx)

      const reloaded = await Account.getOrCreate('testing', 'foo')
      assert.equal(reloaded.balance, '1.0000000')
    })
  })

  describe('getOrCreate', () => {
    it ('should only create a new account if it does not already exist', async () => {
      const sameAccount = await Account.getOrCreate('testing', 'foo')
      assert.equal(account._id, sameAccount._id)

      const otherAccount = await Account.getOrCreate('testing', 'bar', {
        balance: '5.0000000'
      })
      assert.equal(otherAccount.adapter, 'testing')
      assert.equal(otherAccount.uniqueId, 'bar')
      assert.equal(otherAccount.balance, '5.0000000')
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
