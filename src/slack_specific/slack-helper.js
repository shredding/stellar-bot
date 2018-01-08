"use strict";

class SlackHelper {

    /**
     * Takes a string, which usually will be an escaped Slack userID string
     * such as "<@U12345678|dlohnes>". In this case, U12345678 is the slack
     * user ID unique to this person IN THIS TEAM. In order to generate
     * a truly unique user ID, we'll need to append the team ID as well.
     *
     * See: https://api.slack.com/slash-commands#how_do_commands_work
     */
    function extractUserid(str) {
        let result = str.slice(str.indexOf("@")+1, str.indexOf("|"));
        return result
    }
}

module.exports = SlackUtils