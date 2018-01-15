const StellarSdk = require('stellar-sdk')
const EventEmitter = require('events')
const Big = require('big.js')

module.exports = async function (models) {
  const server = new StellarSdk.Server(process.env.STELLAR_HORIZON)
  const keyPair = StellarSdk.Keypair.fromSecret(process.env.STELLAR_SECRET_KEY)
  const publicKey = keyPair.publicKey()
  const callBuilder = server.payments().forAccount(publicKey)
  const Transaction = models.transaction
  const Account = models.account
  const events = new EventEmitter()

  if (process.env.MODE === 'production') {
    StellarSdk.Network.usePublicNetwork()
  } else {
    StellarSdk.Network.useTestNetwork()
  }

  latestTx = await Transaction.latest()

  if (latestTx) {
    callBuilder.cursor(latestTx.cursor)
  }

  callBuilder.stream({
    onmessage: (record) => {
      record.transaction()
        .then(async function(txn) {
          // If this isn't a payment to the account address, skip
          if (record.to != publicKey) {
            return;
          }
          if (record.asset_type != 'native') {
             // If you are a XLM exchange and the customer sends
             // you a non-native asset, some options for handling it are
             // 1. Trade the asset to native and credit that amount
             // 2. Send it back to the customer

             // We haven't implemented that yet! fairx.io to come!
             console.log('Trying to send non-XLM credit.')
             events.emit('NOT_NATIVE_ASSET_RECEIVED', record)
             return;
          }
          try {
            const txInstance = await Transaction.createAsync({
              memoId: txn.memo,
              amount: record.amount,
              createdAt: new Date(record.created_at),
              asset: record.asset_type,
              cursor: record.paging_token,
              source: record.from,
              target: record.to,
              hash: record.transaction_hash,
              type: 'deposit'
            })

            console.log(`Incoming txn: ${txInstance.amount}`)
            events.emit('INCOMING_TRANSACTION', txInstance)
          } catch (exc) {
            console.log('Unable to commit transaction.')
            console.log(exc)
            events.emit('UNABLE_TO_COMMIT_TRANSACTION', exc)
          }
        })
        .catch(function(exc) {
          console.log('Unable to process a record.')
          console.log(exc)
          events.emit('UNABLE_TO_PROCESS_RECORD', exc)
        })
    }
  })

  return {
    address: publicKey,
    events: events,

    /**
     * Build a transaction into the network.
     *
     * to should be a public address
     * amount can be a string or a Big
     * hash should just be something unique - we use the msg id from reddit,
     * but a uuid4 or sth like that would work as well.
     */
    createTransaction: async function (to, amount, hash) {
      let data = {to, amount, hash}

      // Do not deposit to self, it wouldn't make sense
      if (to === publicKey) {
        throw 'WITHDRAWAL_REFERENCE_ERROR'
      }

      // First, check to make sure that the destination account exists.
      // You could skip this, but if the account does not exist, you will be charged
      // the transaction fee when the transaction fails.
      try {
        await server.loadAccount(to)
      } catch (e) {
        if (e instanceof StellarSdk.NotFoundError) {
            const amountNumber = new Big(amount)

            // Account needs to be created
            if (amountNumber.gte(1)) {
              const sourceAccount = await server.loadAccount(publicKey)
              const transaction = new StellarSdk.TransactionBuilder(sourceAccount)
                .addOperation(StellarSdk.Operation.createAccount({
                  destination: to,
                  startingBalance: amount
                }))
                .addMemo(StellarSdk.Memo.text('XLM Tipping bot'))
                .build()
              transaction.sign(keyPair)
              return transaction
            }
          throw 'WITHDRAWAL_DESTINATION_ACCOUNT_DOES_NOT_EXIST'
        }
        throw e
      }

      // If there was no error, load up-to-date information on your account.
      const sourceAccount = await server.loadAccount(publicKey)

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount)
        .addOperation(StellarSdk.Operation.payment({
          destination: to,
          // Because Stellar allows transaction in many currencies, you must
          // specify the asset type. The special "native" asset represents Lumens.
          asset: StellarSdk.Asset.native(),
          amount: amount
        }))
        .addMemo(StellarSdk.Memo.text('XLM Tipping bot'))
        .build()
      transaction.sign(keyPair)
      return transaction
    },

    /**
     * Send a transaction into the horizon network
     */
    send: async function (tx) {
      try {
        await server.submitTransaction(tx)
      } catch (exc) {
        console.log('WITHDRAWAL_SUBMISSION_FAILED')
        console.log(exc)
        throw 'WITHDRAWAL_SUBMISSION_FAILED'
      }
    }
  }
}