const orm = require('orm')
const transaction = require('orm-transaction')
const EventEmitter = require('events')

function configure(model) {
    model.events = new EventEmitter()
    return model
}


module.exports = async () => {
    console.log("Hello")
    const conn_url = process.env.DATABASE_URL ? process.env.DATABASE_URL : `postgres://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_NAME}`
    console.log("Connection URL: " + conn_url)
    const db = await orm.connectAsync(conn_url)
    //
    db.use(transaction)
    //
    // // +++ Model definitions

    const models = {
        account: configure(require('./account')(db)),
        transaction: configure(require('./transaction')(db))
    }

    await db.syncPromise()

    return models
}