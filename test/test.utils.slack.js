const assert = require('assert')
const sutil = require('../src/utils/slack')

describe('slack-utils', () => {
  describe('extract user id', () => {
    it('should remove the preceeding "@" and "<" symbols and also remove anything after and including the "|" symbol', () => {
      let unescaped = "<@U12345678|dlohnes>"
      let extracted = sutil.extractUserId(unescaped)
      let expectedExtraction = "U12345678"
      assert.equal(expectedExtraction, extracted)
    })

    it("should just return the original input if it's unescaped", () => {
      let unescaped = "U12345678"
      let extracted = sutil.extractUserId(unescaped)
      let expectedExtraction = unescaped
      assert.equal(expectedExtraction, extracted)
    })
  })
})
