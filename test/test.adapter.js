const assert = require('assert')
const Adapter = require('../src/adapters/abstract')

describe('adapter', async () => {

  let adapter;

  beforeEach(async () => {
    const config = await require('./setup')()
    adapter = new Adapter(config)
  })

  describe('receivePotentialTip', () => {
    it ('should reject with DO_NOTHING status if no tip included', (done) => {
      let tip = {
        text: 'the text to scan',
        adapter: 'testing',
        sourceId: 'foo'
      }

      adapter.receivePotentialTip(tip).catch((status) => {
        assert.equal(adapter.TIPP_STATUS_DO_NOTHING, status)
        done()
      })
    })

    it ('should reject with INSUFICCIENT_BALANCE if source cant pay', (done) => {
      let tip = {
        text: '+++1 XLM',
        adapter: 'testing',
        sourceId: 'foo'
      }
      adapter.receivePotentialTip(tip).catch((status) => {
        assert.equal(adapter.TIPP_STATUS_INSUFFICIENT_BALANCE, status)
        done()
      })
    })

    it ('should reject with TIPP_STATUS_REFERENCE_ERROR if one tips herself', (done) => {
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
        adapter.receivePotentialTip(tip).catch((status) => {
          assert.equal(adapter.TIPP_STATUS_REFERENCE_ERROR, status)
          done()
        })
      })
    })

    it ('should transfer money and resolve with TIPP_STATUS_TIPPED', (done) => {
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
        adapter.receivePotentialTip(tip).then(async (success) => {
          assert.equal(adapter.TIPP_STATUS_TIPPED, success.status)
          assert.equal('bar', success.targetId)
          assert.equal('1.0000000', success.amount)

          source = await adapter.Account.oneAsync({adapter: 'testing', uniqueId: 'foo'})
          target = await adapter.Account.oneAsync({adapter: 'testing', uniqueId: 'bar'})

          assert.equal(source.balance, '4.0000000')
          assert.equal(target.balance, '1.0000000')
          done()
        })
      })
    })
  })
})
