const assert = require('assert')
const Reddit = require('../src/adapters/reddit.js')

class TestableReddit extends Reddit {
  pollMessages () {}
  pollComments () {}
}

describe('redditAdapter', async () => {

  let redditAdapter;

  beforeEach(async () => {
      const config = await require('./setup')()
      redditAdapter = new TestableReddit(config)
  })

  describe('extractTipAmount', () => {
    it ('should extract valid payments', () => {
      assert.equal('1', redditAdapter.extractTipAmount('foo +++1 XLM bar'))
      assert.equal('1.12', redditAdapter.extractTipAmount('foo +++1.12 XLM bar'))
      assert.equal('100', redditAdapter.extractTipAmount('foo +++100 xlm!'))
      assert.equal('10', redditAdapter.extractTipAmount('foo +++10xlm bar'))
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
      assert.equal('12.543', data.amount)
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data.address)

      const sample2 = '<!-- SC_OFF --><div class="md"><p>1 XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data2 = redditAdapter.extractWithdrawal(sample2)
      assert.equal('1', data2.amount)
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data2.address)

      const sample3 = '<!-- SC_OFF --><div class="md"><p>1\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data3 = redditAdapter.extractWithdrawal(sample3)
      assert.equal('1', data3.amount)
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data3.address)
    })

    it ('should reject invalid withdrawals', () => {
      // Invalid amount
      const sample2 = '<!-- SC_OFF --><div class="md"><p>Test XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      assert.equal(undefined, redditAdapter.extractWithdrawal(sample2))
    })
  })
})
