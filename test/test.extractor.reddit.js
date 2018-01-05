const assert = require('assert')
const RedditExtractor = require('../src/extractors/reddit-extractor.js')


describe('redditExtractor', async () => {

  let redditExtractor;

  beforeEach(async () => {
      redditExtractor = new RedditExtractor()
  })

  describe('extractTipAmount', () => {
    it ('should extract valid payments', () => {
      assert.equal('1', redditExtractor.extractTipAmount('foo +++1 XLM bar'))
      assert.equal('1.12', redditExtractor.extractTipAmount('foo +++1.12 XLM bar'))
      assert.equal('100', redditExtractor.extractTipAmount('foo +++100 xlm!'))
      assert.equal('10', redditExtractor.extractTipAmount('foo +++10xlm bar'))
    })

    it ('should return undefined if no payment is included', () => {
      assert.equal(undefined, redditExtractor.extractTipAmount('foo ++1 XLM bar'))
      assert.equal(undefined, redditExtractor.extractTipAmount('foo 1.12 XLM bar'))
      assert.equal(undefined, redditExtractor.extractTipAmount('hello world'))
    })
  })

  describe('extractWithdrawal', () => {
    it ('should extract valid withdrawals', () => {
      const sample = '<!-- SC_OFF --><div class="md"><p>12.543 XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data = redditExtractor.extractWithdrawal(sample)
      assert.equal('12.543', data.amount)
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data.address)

      const sample2 = '<!-- SC_OFF --><div class="md"><p>1 XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data2 = redditExtractor.extractWithdrawal(sample2)
      assert.equal('1', data2.amount)
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data2.address)

      const sample3 = '<!-- SC_OFF --><div class="md"><p>1\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data3 = redditExtractor.extractWithdrawal(sample3)
      assert.equal('1', data3.amount)
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data3.address)
    })

    it ('should reject invalid withdrawals', () => {
      // Invalid amount
      const sample2 = '<!-- SC_OFF --><div class="md"><p>Test XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      assert.equal(undefined, redditExtractor.extractWithdrawal(sample2))
    })
  })
})
