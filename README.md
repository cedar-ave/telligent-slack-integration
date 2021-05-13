# Telligent-Slack integration in an Azure Function
> Sends notifications of activity in Telligent to Slack channels

## Functions
The parent Function (`telligent-slack`) contains two child functions:
- `content`
- `ideas`

Telligent provides a webhook that sends selected events to an endpoint. These events do not include ideas. (A feature request is logged with Telligent: https://community.telligent.com/community/10/f/ask-the-community/1146446/rest-api-return-results-for-specified-time-period).

Both child functions use the `slackify-html` npm package, modified for this function in `Shared/slackify-html.js`, to transform processed content into Slack posts in Slack syntax (Slack does not accept the _HTML format_ returned in the content body field of the webhook payload) and, depending on the group or container they occurred in, send the posts to designated Slack channels.
- https://stackoverflow.com/questions/53925981/is-there-a-better-way-to-turn-html-to-plain-text-in-javascript-than-a-series-of
- https://stackoverflow.com/questions/53698843/replacing-quot-with-using-common-methods-does-not-work-in-a-javascript-azure

## `content` Function
Comment events are included in the webhook, but the JSON sent is in a different format than other content events (see examples below) and is handled uniquely in the code.

### Azure Logic App trigger
The Azure Function provides an endpoint that can be used with the webhook. After a few days the Function stops posting to Slack, despite experiments with consumption vs. non-consumption plans and other setup options. For this reason an Azure Logic App in the same resource group is used as the endpoint. When an HTTP request is received, it triggers the `content` child Function.

### Function details
- Type: http trigger
- For selected events as determined in the webhooks section of the Telligent `Admininstration` > `Integrations` > `Webhooks` panel
- Selected events include both new content and updated media
- Loops through events because multiples can be sent at once
  - https://community.telligent.com/community/10/f/ask-the-community/1146487/multiple-events-sent-at-once-with-webhook
  - https://stackoverflow.com/questions/54082871/javascript-loop-to-accommodate-filtered-array-of-objects-received-from-a-webhook
- Treats general content events and comments differently because `ContentId` and `ContentTypeId` are returned with general content events whereas comments include only a `CommentId`:

#### General content
```
{
    "events": [
        {
            "TypeId": "98b64792-bzcc-4c27-8dr3-f594322b5087",
            "DateOccurred": "2021-13-05T01:02:39.0760324Z",
            "EventData": {
                "ActorUserId": 1234,
                "ContentId": "2cf16448-4751-4062-98az-b50125921b81",
                "ContentTypeId": "f7e226ab-d79f-485c-9z22-4a79r3f0ec17",
                "BlogPostId": 123,
                "BlogId": 99
            }
        }
    ]
}
```

#### Comments
```
{
    "events": [{
        "TypeId": "98b64792-bzcc-4c27-8dr3-f594322b5087",
        "DateOccurred": "2020-12-08T01:02:58.0194765Z",
        "EventData": {
            "ActorUserId": 5678,
            "CommentId": "8b9143fa-cx07-4592-c455-e02639646ag5"
        }
    }]
}
```

- https://stackoverflow.com/questions/53990376/process-two-nearly-identical-json-blocks-with-one-set-of-code

### Gotcha on wiki `ContainerId`s
[ContainersIds](#groups-vs-containers) are roughly equivalent to `GroupId`s. This is explained in the reference below. However, _comment on wikis_ are not included in a group's `ContainerId`. For this reason, in the block of `if (containerId == ` clauses (which split which webhook events are posted in which Slack channel(s)), a clause must be added for the `ContainerId` specific to the wiki.

### Set up webhook
Telligent > Pencil at top left > `Administration` > `Integrations` > `Webhooks`

## `ideas` Function
- Type: Timer trigger
- Executes every 10 minutes https://stackoverflow.com/questions/53916782/run-azure-function-every-10-minutes-starting-at-1-second-before-each-00x0
- Queries the REST API for ideas posted in the past 10 minutes
- Aligns webhook and local timestamps using the `moment` and `moment-timezone` npm packages
  - https://stackoverflow.com/questions/53891951/conflicting-timestamps-in-javascript-azure-function
  - https://stackoverflow.com/questions/53753338/if-statement-inside-javascript-azure-function-not-working

## Reference

### Using VS Code
VS Code has an Azure Function extension. You can connect the code to a repo so that each time you push, the Function package inside the Function is redeployed.

Create a repo. Sync it to your machine. Using the Azure Function extension icons, set up a project inside the repo. Then add a new function. Use those icons to deploy the function. Inside the Azure Function UI for the extension, go to the Deployment Center. Connect to your repo. I can't remember the exact order of these but that is the idea.

### npm packages
At Kudu > site > wwwroot, use the console to install any dependencies from `package.json` (e.g., `npm install`).

### cron schedule
`59 9,19,29,39,49,59 * * * *` (https://stackoverflow.com/questions/53916782/run-azure-function-every-10-minutes-starting-at-1-second-before-each-00x0)

### JS code sources for Slack posts (ideas timer script)
- https://gist.github.com/scripting/2ab9b6f1f38fe699e451
- https://gist.github.com/csepulv/7174b19c1fbe219f057f1c89b1abc806

### Groups vs. containers
- An idea call through REST API returns `GroupId`.
- A Telligent webhook event does not return `GroupId`, only `ContainerId`.
- Containers vs. groups:
  - https://community.telligent.com/community/10/f/ask-the-community/1146502/container-vs-group-in-rest-api
  - https://community.telligent.com/community/10/f/ask-the-community/1146503/lists-of-containertypeid-applicationtypeid-contenttypeid-etc

### Queries
#### Example

```
https://mysite/api.ashx/v2/search.json?Category=blog&PageSize=1&includefields=url,content.createdbyuser.displayname 
```

#### Query fields
Possible to do 

```
IncludeFields=Url,Content.ContentId
```

You can't currently specify:

```
IncludeFields=Url,Content.CreatedByUser.Id
```

### Azure Function output
To output JSON (this code is not in use - see [Azure Logic app trigger](#azure-logic-app-trigger)):

```
var readyString = "<" + profileUrlNoQuotes + "|" + usernameNoQuotes + "> posted " + "<" + urlNoQuotes + "|" + subjectNoQuotes + ">\n" + trimmedString;

    // Response of the function to be used later
    context.res = {
      body: { readyString }
    };
```

### Shared code
Create a folder at root called **Shared** and a file of shared code (in this case, `slackify-html.js`).

(If working in the Azure Functions UI rather than in the VS Code Azure Functions extension, use Kudu > **site** > **wwwroot**.)

Add `watchDirectories` to host.json (if working in the Azure Functions UI, do this in Function App settings):

```
{
  "version": "2.0",
  "watchDirectories": [
    "Shared"
  ]
}
```

In the Azure Function `index.js` file, reference the shared code:

```
    var slackify = require('../Shared/slackify-html.js');
```

- https://stackoverflow.com/questions/54015261/reference-external-script-in-javascript-azure-function-code

## Troubleshooting
- **If it starts erroring out unexpectedly, restart it in the Azure portal.
- https://stackoverflow.com/questions/54085156/azure-function-triggered-by-webhook-performs-action-on-compounding-list-of-histo
- https://stackoverflow.com/questions/53972297/how-to-determine-why-an-azure-function-app-is-not-triggered-by-a-webhook
- Make sure you have installed _all_ the packages at root, including `moment` and `moment-timezone`.
