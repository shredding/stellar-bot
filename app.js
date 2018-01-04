
require('dotenv').config({path: process.env.NODE_ENV ? './.env' + process.env.NODE_ENV : './.env'})


// +++ Adapters +
const Reddit = require('./src/adapters/reddit')

async function bootstrap () {

  const models = await require('./src/models')()
  const stellar = await require('./src/stellar')(models)

  let config = { models, stellar }

  const adapters = [
    new Reddit(config)
  ]

}

process.on('unhandledRejection', (reason, p) => {
  console.log(reason.stack)
});

bootstrap()