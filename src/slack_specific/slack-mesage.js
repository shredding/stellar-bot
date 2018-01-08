"use strict"

class SLMessage {
  constructor(msgbody) {
    this.token = msgbody.token
    this.team_id = msgbody.team_id
    this.team_domain = msgbody.team_domain
    this.user_id = msgbody.user_id
    this.user_name = msgbody.user_name
    this.command = msgbody.command
    this.text = msgbody.text
    this.response_url = msgbody.response_url
  }

  get uniqueUserID() {
    return this.user_id + "-" + this.team_id
  }
}

module.exports = SLMessage