const assert = require('assert')
const sinon = require('sinon')


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

    it ('should not deposit on the account if action exists', (done) => {
      Transaction.createAsync({
            memoId: 'testing/foo',
            amount: '1.0000000',
            createdAt: new Date('2018-01-01'),
            asset: 'native',
            cursor: 'token',
            source: 'source',
            target: 'target',
            hash: 'hash',
            type: 'deposit'
      }).then((tx) => {
        Account.events.on('DEPOSIT', async () => {
          const exists = await Action.existsAsync({
            hash: 'hash',
            sourceaccount_id: account.id,
            type: 'deposit'
          })
          assert.ok(exists)

          let assertExc;

          try {
            await account.deposit(tx)
          } catch (exc) {
            assertedExc = exc
          }

          assert.equal(assertedExc, 'DUPLICATE_DEPOSIT')
          const reloaded = await Account.getOrCreate('testing', 'foo')
          // 1 + the initial transaction, but not three when we deposit again
          assert.equal(reloaded.balance, '2.0000000')
          done()
        })
      })
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

    // it('should call "new account" callback, passing in unique ID, if-and-only-if a new account was created', async () => {
    //
    //   let callback = sinon.spy(function(){})
    //
    //   const uniqueID = 'newUserUniqueId'
    //
    //   const oldAccount = await Model.getOrCreate('testing', 'foo', null, callback)
    //
    //   const newAccount= await Model.getOrCreate('testing', uniqueID, {
    //     balance: '5.0000000'
    //   }, callback)
    //
    //   assert.equal(true, callback.calledWith(uniqueID))
    //   assert.equal(true, callback.calledOnce)
    // })
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

  describe('userExists', () => {
    it ("should return false if a user with that uniqueID doesn't exist", async () => {
      let unusedID = "123456"
      let modelExists = await Model.userExists('testing', unusedID)
      assert.equal(modelExists, false, "Account with id 123456 should not exist")
    })

    it ("should return true if a user with that uniqueID does exist", async () => {
      let usedId = "foo"
      let modelExists = await Model.userExists('testing', usedId)
      assert.equal(modelExists, true, "Account with id foo should exist")
    })

    it ("should return false if a user with that uniqueID does exist for a different adapter", async () => {
      let usedId = "foo"
      let differentAdapter = "somethingElse"
      let modelExists = await Model.userExists(differentAdapter, usedId)
      assert.equal(modelExists, false, "Account with id foo should not exist on new adapter")
    })
  })
})
