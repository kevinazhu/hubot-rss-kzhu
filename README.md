Hubot RSS Reader
================
RSS Reader for each Chat Channels, works with Hubot.

- https://github.com/kevinazhu/hubot-rss-reader

![screen shot](http://gyazo.com/234dfb14d76bb3de9efd88bfe8dc6522.png)

Requirements
------------

- hubot-brain
  - recommend [@kevinazhu/hubot-mongodb-brain](https://github.com/kevinazhu/hubot-mongodb-brain).

Install
-------

    % yarn add @kevinazhu/hubot-rss-reader

### edit `external-script.json`

```json
["@kevinazhu/hubot-rss-reader"]
```

### Configure (ENV vars)

    export DEBUG=hubot-rss-reader*      # debug print
    export HUBOT_RSS_INTERVAL=600       # 600 sec (default)
    export HUBOT_RSS_HEADER=:sushi:     # RSS Header Emoji (default is "sushi")
    export HUBOT_RSS_USERAGENT=hubot    # (default is "hubot-rss-reader/#{package_version}")
    export HUBOT_RSS_PRINTSUMMARY=true  # print summary (default is "true")
    export HUBOT_RSS_PRINTIMAGE=false   # print image in summary (default is "true")
    export HUBOT_RSS_PRINTMARKDOWN=true # use markdown message (default is "false")
    export HUBOT_RSS_PRINTERROR=false   # print error message (default is "true")
    export HUBOT_RSS_IRCCOLORS=true     # use IRC color message (default is "false")
    export HUBOT_RSS_LIMIT_ON_ADD=false # limit printing entries on add new feed. (default is 5)
    export HUBOT_RSS_ADMIN_USERS=""      # limit dump to special user (list without spaces eg. "user1,user2")
    export HUBOT_RSS_UPLOADIMAGEPREVIEW=true  # upload image preview as file (default is "true")

Usage
-----

### add

    hubot rss add https://github.com/Flipez.atom
    # or
    hubot rss register https://github.com/Flipez.atom


### delete

    hubot rss delete https://github.com/Flipez.atom
    hubot rss delete #room_name (only within the room or for users in HUBOT_RSS_ADMIN_USERS list)

### list

    hubot rss list
    hubot rss dump (only for users in HUBOT_RSS_ADMIN_USERS list)

## About

This project was forked from [hubot-rss-reader](https://github.com/shokai/hubot-rss-reader)
from [shokai](https://github.com/shokai) with the fixes from [yynozk](https://github.com/yynozk)
and [hubot-rss-rolf](https://www.npmjs.com/package/hubot-rss-rolf), while also fixing other minor bugs
to make it useable for rocketchat again.

