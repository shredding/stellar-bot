const orm = require('orm')
const transaction = require('orm-transaction')
const EventEmitter = require('events')

function configure(model) {
  model.events = new EventEmitter()
  return model
}


module.exports = async () => {
  const conn_url = `postgres://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_NAME}`
  const db = await orm.connectAsync(conn_url)

  db.use(transaction)

  // +++ Model definitions

  const models = {
    account: configure(require('./account')(db)),
    transaction: configure(require('./transaction')(db))
  }

  await db.syncPromise()

  return models
}