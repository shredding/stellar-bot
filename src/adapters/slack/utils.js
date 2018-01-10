"use strict";

class SlackUtils {

    /**
     * Takes a string, which usually will be an escaped Slack userID string
     * such as "<@U12345678|dlohnes>". In this case, U12345678 is the slack
     * user ID unique to this person IN THIS TEAM. In order to generate
     * a truly unique user ID, we'll need to append the team ID as well.
     *
     * See: https://api.slack.com/slash-commands#how_do_commands_work
     */
    constructor() {
      this.extractUserId = function (str) {
        // If it doesn't contain @ and |, we're not interested. Just return what's given to us
        if(str.indexOf("@") < 0 || str.indexOf("|") < 0 ) {
            return str
        }
        let result = str.slice(str.indexOf("@") + 1, str.indexOf("|"))
        return result
      }
    }
}

module.exports = new SlackUtils()