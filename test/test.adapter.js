const assert = require('assert')
const Adapter = require('../src/adapters/abstract-adapter')

describe('adapter', async () => {

  let adapter;

  beforeEach(async () => {
    const config = await require('./setup')()
    adapter = new Adapter(config)
  })

  describe('receiveWithdrawalRequest', () => {
    it ('should call withdrawalInvalidAddress if invalid address is given', (done) => {
      adapter.on('withdrawalInvalidAddress', () => done())
      adapter.receiveWithdrawalRequest({
        adapter: 'testing',
        amount: '666',
        uniqueId: 'foo',
        hash: 'bar',
        // someone gave her secret away :-(
        address: 'SBEZDGJO5WYUKVCSE44MANQCJCNOVBPOBJF4RNSAQGKQVTYKOTRUSRNH'
      })
    })

    it ('should call withdrawalFailedWithInsufficientBalance if withdrawal exceed balance', (done) => {
      adapter.on('withdrawalFailedWithInsufficientBalance', () => done())
      adapter.receiveWithdrawalRequest({
        adapter: 'testing',
        amount: '666',
        uniqueId: 'foo',
        hash: 'bar',
        // someone gave her secret away :-(
        address: 'GA2B3GCDNVMANF4TT44KJNYU7TBVTKWY5XWF3Q3BJAPXRPBHXAEIFGBD'
      })
    })
  })

  describe('receivePotentialTip', () => {

    it ('should call onTipWithInsufficientBalance if source cant pay', (done) => {
      let tip = {
        amount: '1.12',
        adapter: 'testing',
        sourceId: 'foo'
      }

      adapter.on('tipWithInsufficientBalance', () => done())
      adapter.receivePotentialTip(tip)

    })

    it ('should reject with onTipReferenceError if one tips herself', (done) => {
      adapter.Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '5.0000000'
      }).then(() => {
        let tip = {
          amount: '1',
          adapter: 'testing',
          sourceId: 'foo',
          targetId: 'foo'
        }
        adapter.on('tipReferenceError', () => done())
        adapter.receivePotentialTip(tip)
      })
    })

    it ('should transfer money and call with onTip', (done) => {
      adapter.Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '5.0000000'
      }).then(() => {
        let tip = {
          amount: '1',
          adapter: 'testing',
          sourceId: 'foo',
          targetId: 'bar'
        }
        adapter.on('tip', async (tip, amount) => {
          assert.equal('1.0000000', amount)

          source = await adapter.Account.oneAsync({adapter: 'testing', uniqueId: 'foo'})
          target = await adapter.Account.oneAsync({adapter: 'testing', uniqueId: 'bar'})

          assert.equal(source.balance, '4.0000000')
          assert.equal(target.balance, '1.0000000')
          done()
        })
        adapter.receivePotentialTip(tip)
      })
    })
  })
})
