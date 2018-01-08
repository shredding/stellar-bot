const assert = require('assert')
const sutil = require('../src/utils/slack')
const message = require('../src/slack_specific/slack-mesage')

describe('slack-message', () => {
  describe('uniqueUserID', () => {
    it('should combine the user_id and team_id to create a unique ID', () => {
      let teamID = "team_id"
      let userID = "user_id"
      let msg = new message({team_id: teamID,
                              user_id: userID})
      assert.equal(msg.uniqueUserID, userID+"-"+teamID)
    })
  })
})
