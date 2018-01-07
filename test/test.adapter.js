const assert = require('assert')
const Adapter = require('../src/adapters/abstract')

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

    it ('should call withdrawalReferenceError if transaction goes to bot account', (done) => {
      adapter.on('withdrawalReferenceError', async () => {
        // account should be refunded
        const account = await Account.getOrCreate('testing', 'foo')
        assert.equal('5.0000000', account.balance)
        done()
      })
      const Transaction = adapter.config.models.transaction
      const Account = adapter.config.models.account
      const source = 'GAKLZ3CMOEMLZWO4EKXLIRDQSZ6XQMNGWCMRSDBJFQITD2TZXYTHBU4X'
      const target = 'GAKLZ3CMOEMLZWO4EKXLIRDQSZ6XQMNGWCMRSDBJFQITD2TZXYTHBU4X'
      const now = new Date()

      Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '5.0000000'
      }).then(() => {
        adapter.config.stellar = {
          createTransaction: () => new Promise((res, rej) => {
            return rej('WITHDRAWAL_REFERENCE_ERROR')
          })
        }
        adapter.receiveWithdrawalRequest({
          adapter: 'testing',
          amount: '5',
          uniqueId: 'foo',
          hash: 'hash',
          address: target
        })
      })
    })

    it ('should call withdrawalDestinationAccountDoesNotExist if transaction goes to non existing account', (done) => {
      adapter.on('withdrawalDestinationAccountDoesNotExist', async () => {
        // account should be refunded
        const account = await Account.getOrCreate('testing', 'foo')
        assert.equal('5.0000000', account.balance)
        done()
      })
      const Transaction = adapter.config.models.transaction
      const Account = adapter.config.models.account
      const source = 'GAKLZ3CMOEMLZWO4EKXLIRDQSZ6XQMNGWCMRSDBJFQITD2TZXYTHBU4X'
      const target = 'GA2B3GCDNVMANF4TT44KJNYU7TBVTKWY5XWF3Q3BJAPXRPBHXAEIFGBD'
      const now = new Date()

      Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '5.0000000'
      }).then(() => {
        adapter.config.stellar = {
          createTransaction: () => new Promise((res, rej) => {
            return rej('WITHDRAWAL_DESTINATION_ACCOUNT_DOES_NOT_EXIST')
          })
        }
        adapter.receiveWithdrawalRequest({
          adapter: 'testing',
          amount: '5',
          uniqueId: 'foo',
          hash: 'hash',
          address: target
        })
      })
    })

    it ('should call withdrawalSubmissionFailed if transaction already exists', (done) => {
      adapter.on('withdrawalSubmissionFailed', async () => {
        // account should be refunded
        const account = await Account.getOrCreate('testing', 'foo')
        assert.equal('5.0000000', account.balance)
        done()
      })
      const Transaction = adapter.config.models.transaction
      const Account = adapter.config.models.account
      const source = 'GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB'
      const target = 'GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OARMDUYEJ5'
      const now = new Date()

      Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '5.0000000'
      }).then(() => {
        Transaction.createAsync({
          memoId: 'XLM Tipping bot',
          amount: '5',
          asset: 'native',
          hash: 'hash',
          type: 'withdrawal',
          target: target,
          source: source
        }).then(() => {
          adapter.config.stellar = {
            address: source,
            createTransaction: () => {}
          }
          adapter.receiveWithdrawalRequest({
            adapter: 'testing',
            amount: '5',
            uniqueId: 'foo',
            hash: 'hash',
            address: target
          })
        })
      })
    })

    it ('should refund withdrawalSubmissionFailed if transaction send fails', (done) => {
      adapter.on('withdrawalSubmissionFailed', async () => {
        // account should be refunded
        const account = await Account.getOrCreate('testing', 'foo')
        assert.equal('5.0000000', account.balance)
        done()
      })
      const Transaction = adapter.config.models.transaction
      const Account = adapter.config.models.account
      const source = 'GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB'
      const target = 'GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OARMDUYEJ5'
      const now = new Date()

      Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '5.0000000'
      }).then(() => {
        adapter.config.stellar = {
          address: source,
          createTransaction: () => {},
          send: () => {
            throw 'WITHDRAWAL_SUBMISSION_FAILED'
          }
        }
        adapter.receiveWithdrawalRequest({
          adapter: 'testing',
          amount: '5',
          uniqueId: 'foo',
          hash: 'hash',
          address: target
        })
      })
    })

    it ('should perform a withdrawal', (done) => {
      adapter.on('withdrawal', async () => {
        // account should be refunded
        const account = await Account.getOrCreate('testing', 'foo')
        assert.equal('0.0000000', account.balance)
        done()
      })
      const Transaction = adapter.config.models.transaction
      const Account = adapter.config.models.account
      const source = 'GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB'
      const target = 'GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OARMDUYEJ5'
      const now = new Date()

      Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '5.0000000'
      }).then(() => {
        adapter.config.stellar = {
          address: source,
          createTransaction: () => {},
          send: () => {}
        }
        adapter.receiveWithdrawalRequest({
          adapter: 'testing',
          amount: '5',
          uniqueId: 'foo',
          hash: 'hash',
          address: target
        })
      })
    })
  })

  // describe('receivePotentialTip', () => {

  //   it ('should call onTipWithInsufficientBalance if source cant pay', (done) => {
  //     let tip = {
  //       amount: '1.12',
  //       adapter: 'testing',
  //       sourceId: 'foo'
  //     }

  //     adapter.on('tipWithInsufficientBalance', () => done())
  //     adapter.receivePotentialTip(tip)

  //   })

  //   it ('should reject with onTipReferenceError if one tips herself', (done) => {
  //     adapter.Account.createAsync({
  //       adapter: 'testing',
  //       uniqueId: 'foo',
  //       balance: '5.0000000'
  //     }).then(() => {
  //       let tip = {
  //         amount: '1',
  //         adapter: 'testing',
  //         sourceId: 'foo',
  //         targetId: 'foo'
  //       }
  //       adapter.on('tipReferenceError', () => done())
  //       adapter.receivePotentialTip(tip)
  //     })
  //   })

  //   it ('should transfer money and call with onTip', (done) => {
  //     adapter.Account.createAsync({
  //       adapter: 'testing',
  //       uniqueId: 'foo',
  //       balance: '5.0000000'
  //     }).then(() => {
  //       let tip = {
  //         amount: '1',
  //         adapter: 'testing',
  //         sourceId: 'foo',
  //         targetId: 'bar'
  //       }
  //       adapter.on('tip', async (tip, amount) => {
  //         assert.equal('1.0000000', amount)

  //         source = await adapter.Account.oneAsync({adapter: 'testing', uniqueId: 'foo'})
  //         target = await adapter.Account.oneAsync({adapter: 'testing', uniqueId: 'bar'})

  //         assert.equal(source.balance, '4.0000000')
  //         assert.equal(target.balance, '1.0000000')
  //         done()
  //       })
  //       adapter.receivePotentialTip(tip)
  //     })
  //   })
  // })
})
