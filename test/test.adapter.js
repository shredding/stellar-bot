const assert = require('assert')
const Adapter = require('../src/adapters/abstract')
const Big = require('big.js')

describe('adapter', async () => {

  let adapter;

  beforeEach(async () => {
    const config = await require('./setup')()
    adapter = new Adapter(config)
  })

  describe('deposit', () => {
    it ('should call onDeposit when the adapter is correct', (done) => {
      const Account = adapter.config.models.account

      adapter.on('deposit', () => done())
      adapter.name = 'testing'

      Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '5.0000000'
      }).then((account) => Account.events.emit('DEPOSIT', account, new Big('50')))
    })

    it ('should not call onDeposit when the adapter is correct', () => {
      const Account = adapter.config.models.account

      adapter.on('deposit', () => { throw new Error() })
      adapter.name = 'testing'

      Account.createAsync({
        adapter: 'foo',
        uniqueId: 'foo',
        balance: '5.0000000'
      }).then((account) => Account.events.emit('DEPOSIT', account, '50'))
    })
  })

  describe('receiveWithdrawalRequest', () => {

    it (`should throw an error if no address is given and the account doesn't have an address on file in the db`, (done) => {
      adapter.receiveWithdrawalRequest({
          adapter: 'testing',
          amount: '666',
          uniqueId: 'foo',
          hash: 'bar'
        }).catch ((e) => {
          done()
        })
    })

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

    it ('refund is performed if transaction already exists', (done) => {
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
        }).then(async () => {
          adapter.config.stellar = {
            address: source,
            createTransaction: () => {}
          }
          await adapter.receiveWithdrawalRequest({
            adapter: 'testing',
            amount: '5',
            uniqueId: 'foo',
            hash: 'hash',
            address: target
          })

          // account should be refunded
          const account = await Account.getOrCreate('testing', 'foo')
          assert.equal('5.0000000', account.balance)
          done()
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

    it ('should perform a withdrawal and create action', (done) => {
      const Transaction = adapter.config.models.transaction
      const Account = adapter.config.models.account
      const Action = adapter.config.models.action

      adapter.on('withdrawal', async () => {
        // account should be refunded
        const account = await Account.getOrCreate('testing', 'foo')
        const action = await Action.oneAsync({hash: 'hash', type: 'withdrawal', sourceaccount_id: account.id})
        assert.equal('0.0000000', account.balance)

        assert.equal('5.0000000', action.amount)
        assert.equal('GA2C5RFPE6GCKMY3US5PAB6UZLKIGSPIUKSLRB6Q723BM2OARMDUYEJ5', action.address)
        done()
      })

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

  describe('receivePotentialTip', () => {

    it ('should call onTipWithInsufficientBalance if source cant pay', (done) => {
      let tip = {
        amount: '1.12',
        adapter: 'testing',
        sourceId: 'foo',
        hash: 'hash'
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
          targetId: 'foo',
          hash: 'hash'
        }
        adapter.on('tipReferenceError', () => done())
        adapter.receivePotentialTip(tip)
      })
    })

    it ('should not do anything if hash already exists', async() => {
      source = await adapter.Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '5.0000000'
      })
      await adapter.config.models.action.createAsync({
        amount: '1.0000000',
        type: 'transfer',
        sourceaccount_id: source.id,
        hash: 'hash'
      })

      let tip = {
          amount: '1',
          adapter: 'testing',
          sourceId: 'foo',
          targetId: 'bar',
          hash: 'hash'
      }
      await adapter.receivePotentialTip(tip)

      source = await adapter.Account.oneAsync({adapter: 'testing', uniqueId: 'foo'})
      target = await adapter.Account.oneAsync({adapter: 'testing', uniqueId: 'bar'})
      actionCount = await adapter.config.models.action.countAsync()

      assert.equal(source.balance, '5.0000000')
      assert.equal(target.balance, '0.0000000')
      assert.equal(actionCount, 1)
    })

    it ('should transfer money, create action and call with onTip', (done) => {
      adapter.Account.createAsync({
        adapter: 'testing',
        uniqueId: 'foo',
        balance: '5.0000000'
      }).then(() => {
        let tip = {
          amount: '1',
          adapter: 'testing',
          sourceId: 'foo',
          targetId: 'bar',
          hash: 'hash'
        }
        adapter.on('tip', async (tip, amount) => {
          assert.equal('1.0000000', amount)

          source = await adapter.Account.oneAsync({adapter: 'testing', uniqueId: 'foo'})
          target = await adapter.Account.oneAsync({adapter: 'testing', uniqueId: 'bar'})
          action = await adapter.config.models.action.oneAsync({sourceaccount_id: source.id, hash: 'hash', type: 'transfer'})

          assert.equal(source.balance, '4.0000000')
          assert.equal(target.balance, '1.0000000')

          assert.equal(action.targetaccount_id, target.id)
          assert.equal(action.sourceaccount_id, source.id)
          assert.equal(action.amount, '1.0000000')
          assert.equal(action.type, 'transfer')
          assert.equal(action.hash, 'hash')

          done()
        })
        adapter.receivePotentialTip(tip)
      })
    })
  })

  describe('setAccountOptions', () => {
    it ('should return an object containing the publc wallet address if the address is valid', () => {
      let desiredWalletAddress = "GDTWLOWE34LFHN4Z3LCF2EGAMWK6IHVAFO65YYRX5TMTER4MHUJIWQKB"
      let optionsObj = { walletAddress : desiredWalletAddress }
      let filteredOptions = adapter.setAccountOptions(optionsObj)
      assert.equal(filteredOptions.walletAddress, desiredWalletAddress, "Wallet address should be the same as it was when it came in")
    })

    it ('should throw an error if you provide an invalid wallet address', (done) => {
      let desiredWalletAddress = "badaddress"
      let optionsObj = { walletAddress : desiredWalletAddress }

      try {
        let filteredOptions = adapter.setAccountOptions(optionsObj)
      } catch (e) {
        done()
      }
    })
  })
})
