const orm = require('orm')
const EventEmitter = require('events')

function configure(model, db) {
  model.events = new EventEmitter()

  /**
   * Wrap db calls in a transaction - postgres only
   */
  model.withinTransaction = async (func) => {
    await db.driver.db.query('BEGIN')
    try {
      const result = await func()
      await db.driver.db.query('COMMIT')
      return result
    } catch (e) {
      await db.driver.db.query('ROLLBACK')
      throw e
    }
  }
  return model
}


module.exports = async () => {
  const conn_url = `postgres://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_NAME}?pool=false`
  const db = await orm.connectAsync(conn_url)

  // +++ Model definitions

  const models = {
    account: configure(require('./account')(db), db),
    transaction: configure(require('./transaction')(db), db),
    action: configure(require('./action')(db), db),
  }

  await db.syncPromise()

  return models
}