require('dotenv').config({path: process.env.NODE_ENV ? './.env' + process.env.NODE_ENV : './.env'})


// +++ Adapters +
const Reddit = require('./src/adapters/reddit')
const Slack = require('./src/adapters/slack/index')

async function bootstrap () {

  const models = await require('./src/models')()
  const stellar = await require('./src/stellar')(models)

  let config = { models, stellar }

  const adapters = [
    new Slack(config)
  ]

  console.log("Alive and kickin'!")

}

bootstrap()