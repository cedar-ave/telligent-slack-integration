# Notifications from Verint to Slack and/or Microsoft Teams when content is posted, processed in an Azure Function

- [Prerequisites](#prerequisites)
  - [Create an Azure Function](#create-an-azure-function)
    - [(Optional) In VS Code](#optional-in-vs-code)
      - [Steps](#steps)
  - [Install npm packages in root of parent Azure Function](#install-npm-packages-in-root-of-parent-azure-function)
  - [Create an Azure Logic App](#create-an-azure-logic-app)
  - [Create a webhook in Verint](#create-a-webhook-in-verint)
  - [Add variables to content/index.js and ideas/index.js](#add-variables-to-contentindexjs-and-ideasindexjs)
  - [If sending messages to Slack](#if-sending-messages-to-slack)
  - [If sending posts to Microsoft Teams](#if-sending-posts-to-microsoft-teams)
  - [Reference on how to get variables and tokens](#reference-on-how-to-get-variables-and-tokens)
    - [Verint API token](#verint-api-token)
    - [Verint Group ID(s)](#verint-group-ids)
    - [Microsoft Team ID and Channel ID](#microsoft-team-id-and-channel-id)
      - [Example](#example)
- [About this Azure Function](#about-this-azure-function)
- [`content` Azure Function](#content-azure-function)
  - [Azure Logic App trigger](#azure-logic-app-trigger)
  - [Azure Function details](#azure-function-details)
    - [General content](#general-content)
    - [Comments](#comments)
  - [Gotcha on wiki `ContainerId`s](#gotcha-on-wiki-containerids)
- [`ideas` Azure Function](#ideas-azure-function)
- [Reference](#reference)
  - [`ideas` Azure Function](#ideas-azure-function-1)
  - [Groups vs. containers](#groups-vs-containers)
  - [Queries](#queries)
    - [Example](#example-1)
    - [Query fields](#query-fields)
  - [Azure Function output](#azure-function-output)
  - [Shared code](#shared-code)
  - [Azure Logic App schema](#azure-logic-app-schema)
- [Troubleshooting](#troubleshooting)
- [Notes](#notes)

This Azure Function sends notifications of content activity in Verint to Slack and/or Microsoft Teams when the following are posted: blog posts, videos, threads, replies, ideas, comments, etc.

![slack-notification](https://user-images.githubusercontent.com/15255009/205156526-b6409951-e7b6-4037-9e80-d1e609df5046.png)

## Prerequisites

### Create an Azure Function

#### (Optional) In VS Code

Deploy the Azure Function from a repo to the cloud. The Azure Function package inside the Azure Function is redeployed.

##### Steps

- Enable the Azure Functions extension.
- Clone this repo to your machine.
- Using the Azure Function extension icons, set up a project inside the local repo.
- Add a new Azure Function locally.
- Deploy the Azure Function to the Azure Portal from your local machine.
- Go to the Azure Function in the Azure Portal.
- Go to the Deployment Center and connect your repo.

### Install npm packages in root of parent Azure Function

- Navigate to the Azure Function home page > Platform features > Advanced tools (Kudu) > CMD prompt navigate to `wwwroot` (site root where `package.json` is).
- Run `npm install`.

### Create an Azure Logic App

- Create an Azure Logic App in the same resource group as the Azure Function.
- Add the `When a HTTP request is received` task.
- In the Logic App, add an Azure Function item and select `content`.
- Save. Copy the `HTTP POST URL`.
- See also [Azure Logic App schema](#azure-logic-app-schema).

![logic-app](https://user-images.githubusercontent.com/15255009/118200730-0ff49e80-b413-11eb-80c5-0b977f2f4aa3.png)

### Create a webhook in Verint

Go to Verint > Click the pencil at top left > `Administration` > `Integrations` > `Webhooks` > Add the URL copied from the Azure Logic App.

### Add variables to content/index.js and ideas/index.js

| Variable(s) to replace | What to replace them with |
|------------------------|---------------------------|
| `ORGANIZATION` | Applicable portion of the Verint community's URL |
| `TOKEN` | [Verint API token](#verint-api-token) |
| `VERINTGROUPID` | [Verint group ID(s)](verint-group-ids) |
| `AZURE LOGIC APP URL` | URL produced by following [these instructions](#create-an-azure-logic-app) |

### If sending messages to Slack

| Variable(s) to replace | What to replace them with |
|------------------------|---------------------------|
| `SLACK INCOMING WEBHOOK` | URL of Slack incoming webhook, created in an app on Slack's website |
| `theUsername` | Name of the bot |
| `theIconEmoji` | Emoji of the bot |
| `color` | HEX value of message's color in Slack |
| (ideas/index.js only) `footer_icon` | Emoji displayed next to the idea category |

### If sending posts to Microsoft Teams

| Variable(s) to replace | What to replace them with |
|------------------------|---------------------------|
| `MICROSOFT TEAM ID` | [Microsoft Team ID](#microsoft-team-id-and-channel-id) |
| `MICROSOFT CHANNEL ID` | [Microsoft Team channel ID](#microsoft-team-id-and-channel-id) |

### Reference on how to get variables and tokens

#### Verint API token

- Go to your Verint site avatar (top right) > **Settings** > **API Keys** (very bottom) > **Manage application API keys** > **Generate new API key**.
- Base-64 encode `apikey:user.name`.

#### Verint Group ID(s)

- Plug the [List Group REST Endpoint](https://community.telligent.com/community/11/w/api-documentation/64702/list-group-rest-endpoint) into a script of [this nature](https://github.com/cedar-ave/verint-get-content-data)).

#### Microsoft Team ID and Channel ID

- In the Microsoft Teams desktop client, click `...` next to the channel name > `Get link to channel`.
- Copy and paste the link somewhere to inspect.

##### Example

```
https://teams.microsoft.com/l/channel/00%0x00x00000xx0x00xx00xx0x000x00000%00thread.skype/General?groupId=xx000x00-0xx0-0x0x-0000-x0xx0000000x&tenantId=00000x0x-000x-0x00-000x-000000x0000x
```

| Variable | Corresponding ID in the link | Example |
| `MICROSOFT CHANNEL ID` | Characters following `channel` | `00:0x00x00000xx0x00xx00xx0x000x00000%00@thread.skype` (note that the HTML in the URL is replaced by the actual characters) | Characters following `groupId` | 
| `MICROSOFT TEAM ID` | `xx000x00-0xx0-0x0x-0000-x0xx0000000x` |

Ignore `tenantId`.

## About this Azure Function

The parent Azure Function (`your-function`) contains two child Azure Functions:
- `content`
- `ideas`

Verint provides [a Generic Content](https://community.telligent.com/community/11/w/api-documentation/64684/generic-content-rest-endpoints) REST API webhook that sends generic content events to an endpoint. These events do not include ideas.[^1]

Both child Azure Functions use the `slackify-html` npm package, modified for this Azure Function in `Shared/slackify-html.js`, to transform processed content into Slack posts in Slack syntax (Slack does not accept the HTML format returned in the content body field of the webhook payload) and, depending on the group or container they occurred in, send the posts to designated Slack and/or Microsoft Teams channels. (Microsoft Teams also accepts the content transformed for Slack.)[^2][^3]

## `content` Azure Function

### Azure Logic App trigger

The Azure Function provides an endpoint that can be used with the webhook.[^4] When a Verint generic-content HTTP post is received, the Azure Logic App triggers the `content` child Azure Function. See [Azure Logic App](#azure-logic-app) for setup details.

### Azure Function details

- Type: `http trigger`
- For selected events as determined in the webhooks section of the Verint `Admininstration` > `Integrations` > `Webhooks` panel
- Selected events include both new content and updated media
- Loops through events because multiples can be sent at once[^5][^6]
- Treats general content events and comments differently because `ContentId` and `ContentTypeId` are returned with general content events whereas comments include only a `CommentId`:

#### General content

Note: `Comment` events are included in the webhook, but the JSON sent is in a different format than other content events (see examples below) and is handled uniquely in the code.

```json
{
    "events": [
        {
            "TypeId": "00x0000-xxxx-0x00-0xx0-x000000x0000",
            "DateOccurred": "2021-13-05T01:02:39.0760324Z",
            "EventData": {
                "ActorUserId": 1234,
                "ContentId": "00x0000-xxxx-0x00-0xx0-x000000x0000",
                "ContentTypeId": "00x0000-xxxx-0x00-0xx0-x000000x0000",
                "BlogPostId": 123,
                "BlogId": 12
            }
        }
    ]
}
```

#### Comments

```json
{
    "events": [{
        "TypeId": "00x0000-xxxx-0x00-0xx0-x000000x0000",
        "DateOccurred": "00x0000-xxxx-0x00-0xx0-x000000x0000",
        "EventData": {
            "ActorUserId": 1234,
            "CommentId": "00x0000-xxxx-0x00-0xx0-x000000x0000"
        }
    }]
}
```

[^7]

### Gotcha on wiki `ContainerId`s

[ContainersIds](#groups-vs-containers) are roughly equivalent to `GroupId`s. This is explained in the reference below. However, _comments on wikis_ are not included in a group's `ContainerId`. For this reason, in the block of `if (containerId == ` clauses (which split which webhook events are posted in which Slack channel(s)), a clause must be added for the `ContainerId` specific to the wiki.

## `ideas` Azure Function

- Type: `Timer trigger`
- Executes every 10 minutes
- Queries the REST API for ideas posted in the past 10 minutes
- Aligns webhook and local timestamps using the `moment` and `moment-timezone` npm packages[^8][^9]

## Reference

### `ideas` Azure Function

- The cron schedule (set in `ideas/function.json`) is `59 9,19,29,39,49,59 * * * *`.[^11]
- JavaScript code sources for Slack posts:[^12][^13]

### Groups vs. containers

- An idea call through REST API returns `GroupId`.
- A Verint webhook event does not return `GroupId`, only `ContainerId`.
- Containers vs. groups[^14][^15]

### Queries

#### Example

```url
https://mysite/api.ashx/v2/search.json?Category=blog&PageSize=1&includefields=url,content.createdbyuser.displayname 
```

#### Query fields

Possible to do:

```plaintext
IncludeFields=Url,Content.ContentId
```

You can't currently specify:

```plaintext
IncludeFields=Url,Content.CreatedByUser.Id
```

### Azure Function output

To output JSON (this code is not in use - see [Azure Logic app trigger](#azure-logic-app-trigger)):

```js
var readyString = "<" + profileUrlNoQuotes + "|" + usernameNoQuotes + "> posted " + "<" + urlNoQuotes + "|" + subjectNoQuotes + ">\n" + trimmedString;

    // Response of the Function to be used later
    context.res = {
      body: { readyString }
    };
```

### Shared code

In a folder at root called **Shared** is a file of shared code (in this case, `slackify-html.js`).

(If working in the Azure Functions UI rather than in the VS Code Azure Functions extension, use Kudu > **site** > **wwwroot**.)

`watchDirectories` is added to host.json. If working in the Azure Functions UI, do this in Azure Function App settings:

```json
{
  "version": "2.0",
  "watchDirectories": [
    "Shared"
  ]
}
```

The shared code is referenced in the Azure Function `index.js` file:

```js
var slackify = require('../Shared/slackify-html.js');
```

[^15]

### Azure Logic App schema

This schema code represents `When a HTTP request is received` > `Request Body JSON Schema`"

```json
{
    "properties": {
        "events": {
            "items": {
                "properties": {
                    "DateOccurred": {
                        "type": "string"
                    },
                    "EventData": {
                        "properties": {
                            "ActorUserId": {
                                "type": "integer"
                            },
                            "BlogId": {
                                "type": "integer"
                            },
                            "BlogPostId": {
                                "type": "integer"
                            },
                            "CommentId": {
                                "type": "string"
                            },
                            "ContentId": {
                                "type": "string"
                            },
                            "ContentTypeId": {
                                "type": "string"
                            },
                            "ForumId": {
                                "type": "integer"
                            },
                            "ForumReplyId": {
                                "type": "integer"
                            },
                            "ForumThreadId": {
                                "type": "integer"
                            },
                            "GalleryId": {
                                "type": "integer"
                            },
                            "MediaId": {
                                "type": "integer"
                            },
                            "WikiId": {
                                "type": "integer"
                            },
                            "WikiPageId": {
                                "type": "integer"
                            }
                        },
                        "type": "object"
                    },
                    "TypeId": {
                        "type": "string"
                    }
                },
                "required": [
                    "TypeId",
                    "DateOccurred",
                    "EventData"
                ],
                "type": "object"
            },
            "type": "array"
        }
    },
    "type": "object"
}
```

## Troubleshooting

- Make sure the Azure Logic App is not turned off.
- If the Azure Function starts erroring out unexpectedly, restart it in the Azure portal.[^16][^17]
- Make sure you have installed all the packages at root, including `moment` and `moment-timezone`.

## Notes

[^1]: A feature request is logged with Verint: https://community.telligent.com/community/10/f/ask-the-community/1146446/rest-api-return-results-for-specified-time-period
[^2]: https://stackoverflow.com/questions/53925981/is-there-a-better-way-to-turn-html-to-plain-text-in-javascript-than-a-series-of
[^3]: https://stackoverflow.com/questions/53698843/replacing-quot-with-using-common-methods-does-not-work-in-a-javascript-azure
[^4]: After a few days the Function stops posting to Slack, despite experiments with consumption vs. non-consumption plans and other setup options. (See [Azure Function output](#azure-function-output) for unused code.) For this reason an Azure Logic App in the same resource group is used as the endpoint.
[^5]: https://community.telligent.com/community/10/f/ask-the-community/1146487/multiple-events-sent-at-once-with-webhook
[^6]: https://stackoverflow.com/questions/54082871/javascript-loop-to-accommodate-filtered-array-of-objects-received-from-a-webhook
[^7]: https://stackoverflow.com/questions/53990376/process-two-nearly-identical-json-blocks-with-one-set-of-code
[^8]: https://stackoverflow.com/questions/53891951/conflicting-timestamps-in-javascript-azure-function
[^9]: https://stackoverflow.com/questions/53753338/if-statement-inside-javascript-azure-function-not-working
[^10]: https://stackoverflow.com/questions/53916782/run-azure-function-every-10-minutes-starting-at-1-second-before-each-00x0
[^11]: https://gist.github.com/scripting/2ab9b6f1f38fe699e451
[^12]: https://gist.github.com/csepulv/7174b19c1fbe219f057f1c89b1abc806
[^13]: https://community.telligent.com/community/10/f/ask-the-community/1146502/container-vs-group-in-rest-api
[^14]: https://community.telligent.com/community/10/f/ask-the-community/1146503/lists-of-containertypeid-applicationtypeid-contenttypeid-etc
[^15]: https://stackoverflow.com/questions/54015261/reference-external-script-in-javascript-azure-function-code
[^16]: https://stackoverflow.com/questions/54085156/azure-function-triggered-by-webhook-performs-action-on-compounding-list-of-histo
[^17]: https://stackoverflow.com/questions/53972297/how-to-determine-why-an-azure-function-app-is-not-triggered-by-a-webhook