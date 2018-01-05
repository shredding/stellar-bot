const assert = require('assert')
const Adapter = require('../src/adapters/abstract')

describe('adapter', async () => {

  let adapter;

  beforeEach(async () => {
    const config = await require('./setup')()
    adapter = new Adapter(config)
  })

  describe('receivePotentialTip', () => {
    it ('should call onNoPotentialTip if no tip included', (done) => {
      let tip = {
        text: 'the text to scan',
        adapter: 'testing',
        sourceId: 'foo'
      }

      adapter.on('noPotentialTip', () => done())
      adapter.receivePotentialTip(tip)

    })

    it ('should call onTipWithInsufficientBalance if source cant pay', (done) => {
      let tip = {
        text: '+++1 XLM',
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
          text: '+++1 XLM',
          adapter: 'testing',
          sourceId: 'foo',
          resolveTargetId: () => {
            return 'foo'
          }
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
          text: '+++1 XLM',
          adapter: 'testing',
          sourceId: 'foo',
          resolveTargetId: () => {
            return 'bar'
          }
        }
        adapter.on('tip', async (tip, amount, resolvedTargetId) => {
          assert.equal('bar', resolvedTargetId)
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
