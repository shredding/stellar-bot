require('dotenv').config({path: process.env.NODE_ENV ? './.env' + process.env.NODE_ENV : './.env'})


async function bootstrap () {

  const models = await require('./src/models')()
  const stellar = await require('./src/stellar')(models)

  let config = { models, stellar }

  // +++ Adapters +
  const adapters = [
    new require('./src/adapters/reddit')(config)
  ]

  console.log("Alive and kickin'!")

}

bootstrap()