//The Telligent webhook is not triggered by ideas; thus they are managed in this separate timer-trigger function (`Ideas`) within the same parent Azure Function as `content`, which intercepts webhook events.

//Prerequisites: in Kudu > CMD prompt > navigate to site root (where package.json is) > `npm install`

module.exports = async function (context, myTimer) {
  var timeStamp = new Date().toISOString();

  var request = require("request");

  var options = {
    url: "https://community.company.com/api.ashx/v2/ideas/ideas.json?PageSize=3",
    headers: {
      "Rest-User-Token": "TOKEN",
      "Content-Type": "application/json",
    },
  };

  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var info = JSON.parse(body);
      var result = info.Ideas;
      for (var i = 0; i < result.length; i++) {
        //Send to Slack
        function sendToSlack(theUsername, theIconEmoji) {
          var theUsername = "Telligent Bot";
          var theIconEmoji = ":idea:";

          var payload = {
            attachments: [
              {
                author_name: username,
                author_link: profileUrl,
                title: title,
                title_link: url,
                text: readyString,
                footer: "Category | " + category,
                color: "#EBB424",
                footer_icon: ":idea:",
              },
            ],
          };
          if (theUsername !== undefined) {
            payload.username = theUsername;
          }
          if (theIconEmoji !== undefined) {
            payload.icon_emoji = theIconEmoji;
          }
          var theRequest = {
            url: urlWebHook,
            method: "POST",
            json: payload,
          };
          request(theRequest, function (error, response, body) {});
        }

        //Get idea fields from JSON
        var username = result[i].AuthorUser.DisplayName;
        var profileUrl = result[i].AuthorUser.ProfileUrl;
        var subject = result[i].Name;
        var url = result[i].Url;
        var text = result[i].Description;
        var category = result[i].Category.Name;

        //HTML to plain text (subject)
        var Entities = require("html-entities").AllHtmlEntities;
        entities = new Entities();
        var title = entities.decode(subject);

        //HTML to plain text (body text)
        var slackify = require("../Shared/slackify-html.js");
        var doc = slackify(text);

        // No line breaks
        var noLineBreak = doc.replace(/\n/g, " ");

        // Limit character length
        var trimmedString = noLineBreak.substring(0, 325);

        //Do not cut off in the middle of a word
        readyString = trimmedString.substr(
          0,
          Math.min(trimmedString.length, trimmedString.lastIndexOf(" "))
        );

        //Get idea timestamp
        var ideaTimeStamp = result[i].CreatedDate;

        //Convert idea create date/time into UTC timestamp to match Function timezone
        var moment = require("moment-timezone");

        var tz = "America/Denver";
        var ideaTimeStampUtc = moment.tz(ideaTimeStamp, tz).utc().format();

        //Cut to the 10 minute of timestamp (which is first 15 char of, e.g., 2018-12-21T23:35:18.894Z)
        var ideaTimeStampCut = ideaTimeStampUtc.substring(0, 15);
        var functionTimeStampCut = timeStamp.substring(0, 15);

        //Compare timestamps - if the 10 minute matches, then print
        if (ideaTimeStampCut == functionTimeStampCut) {
          //Group = Customers
          if (result[i].Challenge.Group.Id == 77) {
            var urlWebHook =
              "SLACKINCOMINGWEBHOOK";
            sendToSlack();
          }

          //Group = Employees
          if (result[i].Challenge.Group.Id == 82) {
            var urlWebHook =
              "SLACKINCOMINGWEBHOOK";
            sendToSlack();
          }
        }
      }
    }
  }
  request(options, callback);
};
