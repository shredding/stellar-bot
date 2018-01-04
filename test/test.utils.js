const assert = require('assert')
const utils = require('../src/utils')


describe('utils', async () => {

  describe('extractPayment', () => {
    it ('should extract valid payments', () => {
      assert.equal('1.0000000', utils.extractPayment('foo +++1 XLM bar').toFixed(7))
      assert.equal('1.1200000', utils.extractPayment('foo +++1.12 XLM bar').toFixed(7))
      assert.equal('100.0000000', utils.extractPayment('foo +++100 xlm!').toFixed(7))
      assert.equal('10.0000000', utils.extractPayment('foo +++10xlm bar').toFixed(7))
    })

    it ('should return undefined if no payment is included', () => {
      assert.equal(undefined, utils.extractPayment('foo ++1 XLM bar'))
      assert.equal(undefined, utils.extractPayment('foo 1.12 XLM bar'))
      assert.equal(undefined, utils.extractPayment('hello world'))
    })
  })

  describe('extractWithdrawal', () => {
    it ('should extract valid withdrawals', () => {
      const sample = '<!-- SC_OFF --><div class="md"><p>12.543 XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data = utils.extractWithdrawal(sample)
      assert.equal('12.5430000', data.amount.toFixed(7))
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data.address)

      const sample2 = '<!-- SC_OFF --><div class="md"><p>1 XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data2 = utils.extractWithdrawal(sample2)
      assert.equal('1.0000000', data2.amount.toFixed(7))
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data2.address)

      const sample3 = '<!-- SC_OFF --><div class="md"><p>1\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      const data3 = utils.extractWithdrawal(sample3)
      assert.equal('1.0000000', data3.amount.toFixed(7))
      assert.equal('GCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z', data3.address)
    })

    it ('should reject invalid withdrawals', () => {
      // No secret keys please
      const sample = '<!-- SC_OFF --><div class="md"><p>12.543 XLM\nSAPF7GZRDP6EE3PDVFOZSSDUBC5HX5YTJEUBLA3VUDFVZY3EZXZTQMWL</p>\n</div><!-- SC_ON -->'
      assert.equal(undefined, utils.extractWithdrawal(sample))

      // Invalid amount
      const sample2 = '<!-- SC_OFF --><div class="md"><p>Test XLM\nGCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      assert.equal(undefined, utils.extractWithdrawal(sample2))

      // Invalid address
      const sample3 = '<!-- SC_OFF --><div class="md"><p>Test XLM\nCB5JOK5XBOVC6NMVUIW3ACNXNV7ZIQDHVZMT326YHZ35SJ4CNVUQ36Z</p>\n</div><!-- SC_ON -->'
      assert.equal(undefined, utils.extractWithdrawal(sample3))
    })
  })
})
