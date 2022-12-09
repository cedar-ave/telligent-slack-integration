//This Verint Azure Function posts Telligent ideas in Slack (independently) and MS Teams (with the support of an Azure Logic App; the Logic App is employed for circumstances in which you do not have privileges to use the MS Teams API directly).
//Verint offers a `genericcontent` webhook triggered by content events, but ideas are not one of those events; thus ideas are managed in this timer-trigger function (`Ideas`) within the same parent Azure Function as `content`, which intercepts `genericcontent` webhook events.
//For Telligent `groupIds`: Use the Telligent API (https://community.telligent.com/community/10/w/api-documentation).
//For Slack endpoints: Create incoming webhooks in Slack.
//For Microsoft Teams `msTeamsTeamId` and `msTeamsChannelId`: In the Microsoft Teams desktop client, click `...` next to the channel name > `Get link to channel` > paste somewhere
//In this example: https://teams.microsoft.com/l/channel/19%3a90b33834ef2b40de95bd1b545c126906%40thread.skype/General?groupId=bf653a14-9aa0-4f0e-9702-c7eb0184624c&tenantId=52807a8b-794c-4c07-825f-578847e1257e
//The characters following `channel` are the `msTeamsChannelId`: e.g.,15:91b32834ef2b50ge15bd1b745l136901@thread.skype (note that the HTML in the URL is replaced by the actual characters)
//The numbers following `groupId` are the `msTeamsTeamId`: e.g.,  qf643e16-0ba0-4g0h-9702-z7ex0184624q
//Ignore `tenantId`

//IMPORTANT! Prerequisites: Azure > {function} > Platform features > Advanced tools (Kudu) > CMD prompt > navigate to site root (where package.json is) > `npm install`.

module.exports = async function (context, myTimer) {
  var timeStamp = new Date().toISOString();

  var request = require("request");

  var options = {
    url: "https://community.ORGANIZATION.com/api.ashx/v2/ideas/ideas.json?PageSize=3",
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
        //Get idea fields from JSON
        var username = result[i].AuthorUser.DisplayName;
        var profileUrl = result[i].AuthorUser.ProfileUrl;
        var subject = result[i].Name;
        var url = result[i].Url;
        var text = result[i].Description;
        var category = result[i].Category.Name;

        //Send to Slack
        function sendToSlack(theUsername, theIconEmoji) {
          var theUsername = "Verint Bot";
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

        function msteams() {
          const azureLogicAppUrl = "AZURE LOGIC APP URL";
          fetch(azureLogicAppUrl, {
            method: "POST",
            headers: {
              Accept: "application/json, text/plain, */*",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              team: msTeamsTeamId,
              channel: msTeamsChannelId,
              name: username,
              profileUrl: profileUrl,
              title: subject,
              link: url,
              text: readyString,
            }),
          })
            //Sends JSON to Azure Logic App, which parses and pushes to Microsoft Teams
            .then(
              (response) => response.text() // .json(), etc.
              // same as function(response) {return response.text();}
            );
        }

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
          //Verint group aka container = Customers
          if (result[i].Challenge.Group.Id == VERINTGROUPID) {
            var urlWebHook = "SLACK INCOMING WEBHOOK";
            sendToSlack();

            // Send to Microsoft Teams channel
            var msTeamsTeamId = "MICROSOFT TEAM ID";
            var msTeamsChannelId = "MICROSOFT TEAM CHANNEL ID";
            msteams();
          }

          //Verint group aka container = Employees
          if (result[i].Challenge.Group.Id == VERINTGROUPID) {
            var urlWebHook = "SLACK INCOMING WEBHOOK";
            sendToSlack();

            // Send to Microsoft Teams channel
            var msTeamsTeamId = "MICROSOFT TEAM ID";
            var msTeamsChannelId = "MICROSOFT TEAM CHANNEL ID";
            msteams();
          }
        }
      }
    }
  }
  request(options, callback);
};
