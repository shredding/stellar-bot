const assert = require('assert')
const utils = require('../src/utils/utils')


describe('models / transaction', async () => {

  let Transaction;
  let Account;

  beforeEach(async () => {
    const config = await require('./setup')()
    Transaction = config.models.transaction
    Account = config.models.account
  })

  describe('deposit', () => {
    it ('should credit deposits to associated accounts', async () => {
      await Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '1.5000000'
      })

      await Transaction.createAsync({
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

      await utils.sleep(200)

      const acc = await Account.oneAsync({ adapter: 'testing', uniqueId: 'foo'})
      assert.equal('6.5000000', acc.balance)

      const txn = await Transaction.oneAsync({ hash: 'hash' })
      assert.ok(txn.credited)
    })
  })

  describe('latest', () => {
    it ('should only get the last created one', async () => {
      await Transaction.createAsync({
            memoId: 'a',
            amount: '5.0000000',
            createdAt: new Date('2018-01-01'),
            asset: 'native',
            cursor: 'token',
            source: 'source',
            target: 'target',
            hash: 'hash',
            type: 'deposit'
      })
      await Transaction.createAsync({
            memoId: 'b',
            amount: '5.0000000',
            createdAt: new Date('2018-01-03'),
            asset: 'native',
            cursor: 'token',
            source: 'source',
            target: 'target',
            hash: 'hash2',
            type: 'deposit'
      })
      await Transaction.createAsync({
            memoId: 'c',
            amount: '5.0000000',
            createdAt: new Date('2018-01-02'),
            asset: 'native',
            cursor: 'token',
            source: 'source',
            target: 'target',
            hash: 'hash3',
            type: 'deposit'
      })

      const tx = await Transaction.latest()
      assert.equal(tx.memoId, 'b')

    })
  })
})
