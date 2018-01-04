module.exports = async () => {
  require('dotenv').config({path: './.env.' + process.env.NODE_ENV })

  models = await require('../src/models')()

  // Refresh all tables ...
  for (model in models) {
    await models[model].dropAsync()
    await models[model].syncPromise()
  }

  return {
    models: models
  }
}