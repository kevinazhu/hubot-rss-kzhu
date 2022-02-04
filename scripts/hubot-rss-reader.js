/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//   Hubot RSS Reader
//
// Commands:
//   hubot rss add https://github.com/Flipez.atom
//   hubot rss delete https://brauser.io/index.xml
//   hubot rss delete #room_name
//   hubot rss list
//
// Author:
//   @Flipez

'use strict';

const fs         = require('fs');
const path       = require('path');
const _          = require('lodash');
const debug      = require('debug')('hubot-rss-reader');
const request    = require('request');
const Promise    = require('bluebird');
const RSSChecker = require(path.join(__dirname, '../libs/rss-checker'));
const FindRSS    = Promise.promisify(require('find-rss'));
const { Curl }   = require('node-libcurl');
const { getLinkPreview } = require('link-preview-js');
const download   = require('image-downloader')

//# config
const package_json = require(path.join(__dirname, '../package.json'));
if (!process.env.HUBOT_RSS_INTERVAL) { process.env.HUBOT_RSS_INTERVAL = 60*10; }  // 10 minutes
if (!process.env.HUBOT_RSS_HEADER) { process.env.HUBOT_RSS_HEADER = ':sushi:'; }
if (!process.env.HUBOT_RSS_USERAGENT) { process.env.HUBOT_RSS_USERAGENT = `hubot-rss-kzhu/${package_json.version}`; }
if (!process.env.HUBOT_RSS_PRINTSUMMARY) { process.env.HUBOT_RSS_PRINTSUMMARY = "true"; }
if (!process.env.HUBOT_RSS_PRINTIMAGE) { process.env.HUBOT_RSS_PRINTIMAGE = "true"; }
if (!process.env.HUBOT_RSS_PRINTMARKDOWN) { process.env.HUBOT_RSS_PRINTMARKDOWN = "false"; }
if (!process.env.HUBOT_RSS_PRINTERROR) { process.env.HUBOT_RSS_PRINTERROR = "true"; }
if (!process.env.HUBOT_RSS_IRCCOLORS) { process.env.HUBOT_RSS_IRCCOLORS = "false"; }
if (!process.env.HUBOT_RSS_LIMIT_ON_ADD) { process.env.HUBOT_RSS_LIMIT_ON_ADD = 5; }
if (!process.env.HUBOT_RSS_ADMIN_USERS) { process.env.HUBOT_RSS_ADMIN_USERS = ""; }
if (!process.env.HUBOT_RSS_UPLOADIMAGEPREVIEW) { process.env.HUBOT_RSS_UPLOADIMAGEPREVIEW = "true"; }

module.exports = function(robot) {
    var authHeaders = null;
    const loggedIn = function() {
        return (authHeaders !== null)
    }
    const login = async function() {
        try {
            var result = await robot.adapter.api.login();
            authHeaders = [
                'X-User-Id: ' + result.data.userId,
                'X-Auth-Token: ' + result.data.authToken
            ]
        } catch(err) {
            robot.logger.error(err);
        }
    }

    const logger = {
        info(msg) {
            if (debug.enabled) { return debug(msg); }
            if (typeof msg !== 'string') { msg = JSON.stringify(msg); }
            return robot.logger.info(`${debug.namespace}: ${msg}`);
        },
        error(msg) {
            if (debug.enabled) { return debug(msg); }
            if (typeof msg !== 'string') { msg = JSON.stringify(msg); }
            return robot.logger.error(`${debug.namespace}: ${msg}`);
        }
    };

    const send_queue = [];
    const send = (room, body, url=null) => send_queue.push({room, body, url});

    const getRoom = function(msg) {
        switch (robot.adapterName) {
            case 'hipchat':
                return msg.message.user.reply_to;
            default:
                return msg.message.room;
        }
    };

    const sendWithImagePreview = async function(roomName, body, url) {
        if (!loggedIn()) {
            await login();
        }

        const file = await downloadLinkPreviewImage(url);
        robot.adapter.api.get('rooms.info', { roomName }).then(result => {
            const roomId = result.room._id;
            const curl = new Curl();

            curl.setOpt(Curl.option.URL, robot.adapter.api.url + 'rooms.upload/' + roomId);
            curl.setOpt(Curl.option.HTTPHEADER, authHeaders)
            curl.setOpt(Curl.option.HTTPPOST, [
                { name: 'file', file },
                { name: 'msg', contents: body }
            ]);

            curl.on("end", function (statusCode, data, headers) {
                fs.unlink(file, (err) => {
                    if (err) {
                        robot.logger.error("Unable to delete " + file);
                    }
                });
                this.close();
            });

            curl.on("error", function (statusCode, data, headers) {
                robot.logger.error("Status code " + statusCode);
                robot.logger.error("***");
                robot.logger.error("Response: " + data);
                this.close();
            });

            curl.perform();
        })
    }

    const downloadLinkPreviewImage = async function(url) {
        try {
            var data = await getLinkPreview(url);
            if ('images' in data && data.images.length > 0) {
                const imageLink = data.images[0];

                const { filename } = await download.image({ url: imageLink, dest: '/tmp' });
                return filename;
            }
        } catch(err) {
            robot.logger.error(err);
        }
    }

    setInterval(function() {
            if (typeof robot.send !== 'function') { return; }
            if (send_queue.length < 1) { return; }
            const msg = send_queue.shift();
            try {
                if (msg.url === null || process.env.HUBOT_RSS_UPLOADIMAGEPREVIEW !== "true") {
                    return robot.send({ room: msg.room }, msg.body);
                } else {
                    return sendWithImagePreview(msg.room, msg.body, msg.url);
                }
            } catch (err) {
                logger.error(`Error on sending to room: \"${msg.room}\"`);
                return logger.error(err);
            }
        }
        , 2000);

    const checker = new RSSChecker(robot);

    //# wait until connect redis
    robot.brain.once('loaded', function() {
        var run = function(opts) {
            logger.info("checker start");
            return checker.check(opts)
                .then(function() {
                        logger.info(`wait ${process.env.HUBOT_RSS_INTERVAL} seconds`);
                        return setTimeout(run, 1000 * process.env.HUBOT_RSS_INTERVAL);
                    }
                    , function(err) {
                        logger.error(err);
                        logger.info(`wait ${process.env.HUBOT_RSS_INTERVAL} seconds`);
                        return setTimeout(run, 1000 * process.env.HUBOT_RSS_INTERVAL);
                    });
        };

        return run();
    });


    const last_state_is_error = {};

    checker.on('new entry', function(entry) {
        last_state_is_error[entry.feed.url] = false;
        return (() => {
            const result = [];
            const object = checker.getAllFeeds();
            for (let room in object) {
                const feeds = object[room];
                if ((room !== entry.args.room) && _.includes(feeds, entry.feed.url)) {
                    logger.info(`${entry.title} ${entry.url} => ${room}`);
                    result.push(send(room, entry.toString(), entry.url));
                } else {
                    result.push(undefined);
                }
            }
            return result;
        })();
    });

    checker.on('error', function(err) {
        logger.error(err);
        if (process.env.HUBOT_RSS_PRINTERROR !== "true") {
            return;
        }
        if (last_state_is_error[err.feed.url]) {  // reduce error notify
            return;
        }
        last_state_is_error[err.feed.url] = true;
        return (() => {
            const result = [];
            const object = checker.getAllFeeds();
            for (let room in object) {
                const feeds = object[room];
                if (_.includes(feeds, err.feed.url)) {
                    result.push(send(room, `[ERROR] ${err.feed.url} - ${err.error.message || err.error}`));
                } else {
                    result.push(undefined);
                }
            }
            return result;
        })();
    });

    robot.respond(/rss\s+(add|register)\s+(https?:\/\/[^\s]+)$/im, function(msg) {
        const url = msg.match[2].trim();
        last_state_is_error[url] = false;
        logger.info(`add ${url}`);
        const room = getRoom(msg);
        return checker.addFeed(room, url)
            .then(res =>
                new Promise(function(resolve) {
                    msg.send(res);
                    return resolve(url);
                })).then(url => checker.fetch({url, room}))
            .then(function(entries) {
                    const entry_limit =
                        process.env.HUBOT_RSS_LIMIT_ON_ADD === 'false' ?
                            entries.length
                            :
                            process.env.HUBOT_RSS_LIMIT_ON_ADD - 0;
                    for (let entry of Array.from(entries.splice(0, entry_limit))) {
                        logger.info(`${entry.title} ${entry.url} => ${room}`);
                        send(room, entry.toString(), entry.url);
                    }
                    if (entries.length > 0) {
                        return send(room, `${process.env.HUBOT_RSS_HEADER} ${entries.length} entries has been omitted`);
                    }
                }
                , function(err) {
                    msg.send(`[ERROR] ${err}`);
                    if (err.message !== 'Not a feed') { return; }
                    return checker.deleteFeed(room, url)
                        .then(() => FindRSS(url)).then(function(feeds) {
                            if ((feeds != null ? feeds.length : undefined) < 1) { return; }
                            return msg.send(_.flatten([
                                    `found some Feeds from ${url}`,
                                    feeds.map(i => ` * ${i.url}`)
                                ]).join('\n')
                            );
                        });
                }).catch(function(err) {
                msg.send(`[ERROR] ${err}`);
                return logger.error(err.stack);
            });
    });


    robot.respond(/rss\s+delete\s+(https?:\/\/[^\s]+)$/im, function(msg) {
        const url = msg.match[1].trim();
        logger.info(`delete ${url}`);
        return checker.deleteFeed(getRoom(msg), url)
            .then(res => msg.send(res)).catch(function(err) {
                msg.send(err);
                return logger.error(err.stack);
            });
    });

    robot.respond(/rss\s+delete\s+#([^\s]+)$/im, function(msg) {
        const room = msg.match[1].trim();
        logger.info(`delete #${room}`);
        return checker.deleteRoom(room, msg.message.room, msg.message.user.name)
            .then(res => msg.send(res)).catch(function(err) {
                msg.send(err);
                return logger.error(err.stack);
            });
    });

    robot.respond(/rss\s+list$/i, function(msg) {
        const feeds = checker.getFeeds(getRoom(msg));
        if (feeds.length < 1) {
            return msg.send("nothing");
        } else {
            return msg.send(feeds.join("\n"));
        }
    });

    robot.respond(/rss\s+version$/i, msg => msg.send(`RSS Reader Version (${package_json.version})`));

    return robot.respond(/rss dump$/i, function(msg) {
        let needle;
        if ((needle = msg.message.user.name, Array.from(process.env.HUBOT_RSS_ADMIN_USERS.split(",")).includes(needle))) {
            const feeds = checker.getAllFeeds();
            if (process.env.HUBOT_RSS_PRINTMARKDOWN === "true") {
                return msg.send(`\`\`\`${JSON.stringify(feeds, null, 2)}\`\`\``);
            } else {
                return msg.send(JSON.stringify(feeds, null, 2));
            }
        } else {
            return msg.send("not allowed");
        }
    });
};
