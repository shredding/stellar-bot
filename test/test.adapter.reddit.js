const assert = require('assert')
const Reddit = require('../src/adapters/reddit.js')

describe('redditAdapter', async () => {

  let redditAdapter;

  beforeEach(async () => {
      const config = await require('./setup')()
      redditAdapter = new Reddit(config)
  })

  describe('extractTipAmount', () => {
    it ('should extract valid payments', () => {
      assert.equal('1.0000000', redditAdapter.extractTipAmount('foo +++1 XLM bar').toFixed(7))
      assert.equal('1.1200000', redditAdapter.extractTipAmount('foo +++1.12 XLM bar').toFixed(7))
      assert.equal('100.0000000', redditAdapter.extractTipAmount('foo +++100 xlm!').toFixed(7))
      assert.equal('10.0000000', redditAdapter.extractTipAmount('foo +++10xlm bar').toFixed(7))
    })

    it ('should return undefined if no payment is included', () => {
      assert.equal(undefined, redditAdapter.extractTipAmount('foo ++1 XLM bar'))
      assert.equal(undefined, redditAdapter.extractTipAmount('foo 1.12 XLM bar'))
      assert.equal(undefined, redditAdapter.extractTipAmount('hello world'))
    })
  })

  describe('extractWithdrawal', () => {
    it ('should extract valid withdrawals', () => {
      const sample = '<!-- SC_OFF --><div class="md"><p>12.543 XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data = redditAdapter.extractWithdrawal(sample)
      assert.equal('12.5430000', data.amount.toFixed(7))
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data.address)

      const sample2 = '<!-- SC_OFF --><div class="md"><p>1 XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data2 = redditAdapter.extractWithdrawal(sample2)
      assert.equal('1.0000000', data2.amount.toFixed(7))
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data2.address)

      const sample3 = '<!-- SC_OFF --><div class="md"><p>1\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data3 = redditAdapter.extractWithdrawal(sample3)
      assert.equal('1.0000000', data3.amount.toFixed(7))
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data3.address)
    })

    it ('should reject invalid withdrawals', () => {
      // No secret keys please
      const sample = '<!-- SC_OFF --><div class="md"><p>12.543 XLM\nSAPF7GZRDP6EE3PDVFOZSSDUBC5HX5YTJEUBLA3VUDFVZY3EZXZTQMWL</p>\n</div><!-- SC_ON -->'
      assert.equal(undefined, redditAdapter.extractWithdrawal(sample))

      // Invalid amount
      const sample2 = '<!-- SC_OFF --><div class="md"><p>Test XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      assert.equal(undefined, redditAdapter.extractWithdrawal(sample2))

      // Invalid address
      const sample3 = '<!-- SC_OFF --><div class="md"><p>Test XLM\nCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      assert.equal(undefined, redditAdapter.extractWithdrawal(sample3))
    })
  })
})
