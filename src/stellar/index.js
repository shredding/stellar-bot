const StellarSdk = require('stellar-sdk')
const EventEmitter = require('events')

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
  
  console.log('Start streaming txns ...')
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
    depositAddress: publicKey,
    events: events,
    send: function send(to, amount, hash) {
      let data = {to, amount, hash}
      return new Promise(function (resolve, reject) {
        // Do not deposit to self, it wouldn't make sense
        if (to === publicKey) {
          data.status = 'WITHDRAWAL_REFERENCE_ERROR'
          return reject(data)
        }

        // First, check to make sure that the destination account exists.
        // You could skip this, but if the account does not exist, you will be charged
        // the transaction fee when the transaction fails.
        server.loadAccount(to)
          // If the account is not found, surface a nicer error message for logging.
          .catch(StellarSdk.NotFoundError, function (error) {
            data.status = 'WITHDRAWAL_DESTINATION_ACCOUNT_DOES_NOT_EXIST'
            return reject(data)
          })
          // If there was no error, load up-to-date information on your account.
          .then(function() {
            return server.loadAccount(publicKey);
          })
          .then(async function(sourceAccount) {
            // Start building the transaction.
            var transaction = new StellarSdk.TransactionBuilder(sourceAccount)
              .addOperation(StellarSdk.Operation.payment({
                destination: to,
                // Because Stellar allows transaction in many currencies, you must
                // specify the asset type. The special "native" asset represents Lumens.
                asset: StellarSdk.Asset.native(),
                amount: amount
              }))
              // A memo allows you to add your own metadata to a transaction. It's
              // optional and does not affect how Stellar treats the transaction.
              .addMemo(StellarSdk.Memo.text('XLM Tipping bot'))
              .build()
            // Sign the transaction to prove you are actually the person sending it.
            transaction.sign(keyPair);

            // And finally, send it off to Stellar!
            const now = new Date()
            const doc = {
              memoId: 'XLM Tipping bot',
              amount: amount,
              createdAt: now.toISOString(),
              asset: 'native',
              source: publicKey,
              target: to,
              hash: hash,
              type: 'withdrawal'
            }
            const submitted = await Transaction.wrapAtomicSend(
              server, 'submitTransaction', transaction, doc
            )
            const exists = await Transaction.existsAsync({
              hash: hash,
              type: 'withdrawal',
              target: to
            })
            return submitted
          })
          .then(async function(result) {
            data.status = 'WITHDRAWAL_SUCCESS'
            resolve(data)
          })
          .catch(function(error) {
            console.log('WITHDRAWAL_STATUS_SUBMISSION_FAILED')
            console.log(error)
            reject('WITHDRAWAL_SUBMISSION_FAILED')
          })
        })
    }
  }
}