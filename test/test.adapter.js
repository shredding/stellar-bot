const assert = require('assert')
const Adapter = require('../src/adapters/abstract-adapter')

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
  })
})
