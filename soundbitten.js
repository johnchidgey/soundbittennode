#!/usr/bin/env node

'use strict';

const folderLocalPath = '/Users/johnchidgey/Documents/sites/engineered/data/soundbites/';
const folderServerPath = '/app/soundbites/soundbites'; // MODIFIED T

// Install jsdom
var path = require('path');
var fs = require('fs');
var webSocket = require('ws');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
var fetch = require("node-fetch-commonjs");

var podcastFileItems = [];
var podcasts = [];
var soundbitesLocal = [];
var soundbites = [];
var soundbite = [{episode:"", enabled:"", startTime:"", duration:"", title:"", url:"", name:"", type:"", address:"", customKey:"", customValue:""}];
var podcastFeedItems = [];
var folderPath = ''; // MODIFIED

// Extract all exiting SoundBite JSON Files from local storage
try {
  if(process.env.NODE_ENV === 'production') folderPath = folderServerPath; // MODIFIED
  else folderPath = folderLocalPath; // MODIFIED
  var directoryList = fs.readdirSync(folderPath, { withFileTypes: true });
  directoryList.forEach(function (directory) {
    if (directory.isDirectory())
      podcastFileItems.push({folder:directory.name});
    }); // End ForEach for Directories
    console.log(directoryList);
  podcastFileItems.forEach((podcast, index, fullArray) => {
    var podcastFolder = path.join(folderPath, podcast.folder);
    soundbitesLocal = [];
    try {
      var fileList = fs.readdirSync(podcastFolder, { withFileTypes: true });
      fileList.forEach(function (file) {
        if ((file.isFile()) && (path.extname(file.name) == ".json")) {
          var filePath = path.join(podcastFolder, file.name);
          try {
            var data = fs.readFileSync(filePath, 'utf8'); // parse JSON string to JSON object
            var rawJSON = JSON.parse(data);
            if (file.name == "index.json") {
              podcastFileItems[index].title = rawJSON.title;
              podcastFileItems[index].url = rawJSON.url;
            }
            else {
              var episode = path.basename(file.name, path.extname(file.name));
              soundbitesLocal.push({episode:episode, soundbites:rawJSON});
            }
          } catch(err) { console.log(`Error reading file from disk: ${err}`); }
        } // End IF JSON
      }); // End ForEach Files Loop
    } catch(err) { console.log('Unable to scan directory: ' + err); }
    if (soundbitesLocal.length > 0) { podcastFileItems[index].soundbites = soundbitesLocal; }
  }); // End ForEach Podcast Directories
} catch(err) { console.log('Unable to scan directory: ' + err); }


// Extract all episodes for each podcast from RSS feed
try {
  podcastFileItems.forEach((podcast, index, fullArray) => {
    var RSS_URL = podcast.url;
    var episode, title, soundbitesOpen, enclosureSoundbites, enclosureFeed, enclosure;
    var podcastItems = [];
    fetch(RSS_URL)
    .then(response => response.text())
    .then(str => new JSDOM(str, 'text/xml'))//, { features: { QuerySelector: true } }))
    .then(data => {
      const allitems = data.window.document.querySelectorAll("item", data);
      var feedURL = data.window.document.querySelector('atom\\:link') ? data.window.document.querySelector('atom\\:link').getAttribute("href") : "";
      podcastItems = [];
      allitems.forEach(item => {
        episode = item.querySelector('itunes\\:episode') ? item.querySelector('itunes\\:episode').textContent : "";
        title = item.querySelector('title') ? item.querySelector('title').textContent : "";
        soundbitesOpen = item.querySelector('podcast\\:soundbites') ? item.querySelector('podcast\\:soundbites').getAttribute("open") : "";
        enclosureSoundbites = item.querySelector('podcast\\:soundbites') ? item.querySelector('podcast\\:soundbites').getAttribute("enclosure") : "";
        enclosureFeed = item.querySelector("enclosure") ? item.querySelector("enclosure").getAttribute("url") : "";
        enclosure = enclosureSoundbites ? enclosureSoundbites : enclosureFeed; // Use the URL in the Soundbite tag, if present
        if (episode != "") podcastItems.push({'episode':episode, 'title':title, 'enclosure':enclosure, 'soundbites':soundbitesOpen});
      });
      podcastFeedItems.push({url: feedURL, episodes: podcastItems}); // TBD Need to add the Podcast name / title to link the two datasets, currently just an Array not a Key:Value store
    });
  });
} catch(err) { console.log('Unable to read RSS: ' + err); }


/***************************************************
 * WEB SOCKETS                                     *
 ***************************************************/

//var port = process.env.PORT || 3000;
var port = 5001;
var proxied = process.env.PROXIED === 'true';
var socketServer = new webSocket.Server({port: port});
var titles = [];
var connections = [];

// DOS protection - we disconnect any address which sends more than windowLimit
// messages in a window of windowSize milliseconds.
var windowLimit = 50;
var windowSize = 5000;
var currentWindow = 0;
var recentMessages = {};

console.log(socketServer);

function floodedBy(socket) {
    // To be called each time we get a message or connection attempt. If that address has been flooding us, we disconnect all open connections
    // from that address and return `true` to indicate that it should be ignored. (They will not be prevented from re-connecting after waiting
    // for the next window.)
    if (socket.readyState == socket.CLOSED) {
        return true;
    }

    var address = getRequestAddress(socket.upgradeReq);

    var updatedWindow = 0 | ((new Date) / windowSize);
    if (currentWindow !== updatedWindow) {
        currentWindow = updatedWindow;
        recentMessages = {};
    }

    if (address in recentMessages) {
        recentMessages[address]++;
    } else {
        recentMessages[address] = 1;
    }

    if (recentMessages[address] > windowLimit) {
        console.warn("Disconnecting flooding address: " + address);
        socket.terminate();

        for (var i = 0, l = connections.length; i < l; i++) {
            if (getRequestAddress(connections[i].upgradeReq) === address &&
                connections[i] != socket) {
                console.log("Disconnecting additional connection.");
                connections[i].terminate();
            }
        }

        return true;
    } else {
        return false;
    }
}

function getRequestAddress(request) {
    if (proxied && 'x-forwarded-for' in request.headers) {
        // This assumes that the X-Forwarded-For header is generated by a trusted proxy such as Heroku. If not, a malicious user could take
        // advantage of this logic and use it to to spoof their IP.
        var forwardedForAddresses = request.headers['x-forwarded-for'].split(',');
        return forwardedForAddresses[forwardedForAddresses.length - 1].trim();
    } else {
        // This is valid for direct deployments, without routing/load balancing.
        return request.connection.remoteAddress;
    }
}


function mergeFeedAndFile() {
  podcasts = [];
  var episodeEntries = [];
  var soundbiteFile = [];
  podcastFileItems.forEach((fileItem, fileIndex) => {
    episodeEntries = [];
    podcastFeedItems.forEach((feedItem, feedIndex) => {
      if(feedItem.url == fileItem.url) {
        feedItem.episodes.forEach((episodeItem, episodeIndex) => {
          soundbiteFile = [];
          if(fileItem.soundbites) {
            fileItem.soundbites.forEach((soundbiteItem, soundbiteIndex) => {
              if(soundbiteItem.episode == episodeItem.episode) {
                soundbiteFile = soundbiteItem.soundbites;
              }
            });
          }
          if(soundbiteFile.length > 0) episodeEntries.push({'episode':episodeItem.episode, 'title':episodeItem.title, 'enclosure':episodeItem.enclosure, 'soundbitesOpen':episodeItem.soundbites, 'soundbites':soundbiteFile});
          else episodeEntries.push({'episode':episodeItem.episode, 'title':episodeItem.title, 'enclosure':episodeItem.enclosure, 'soundbitesOpen':episodeItem.soundbites});
        });
      }
    });
    podcasts.push({title:fileItem.title, folder:fileItem.folder, url:fileItem.url, episodes:episodeEntries});
  });
}


socketServer.on('connection', function(socket, req) {
    socket.upgradeReq = req;
    if (floodedBy(socket)) return;

    connections.push(socket);
    var address = getRequestAddress(socket.upgradeReq);
    console.log('Client connected: ' + address);
    // Okay this is a hack - should be forcing a Sync Fetch but that's annoying
    if(podcastFileItems.length == podcastFeedItems.length) {
      mergeFeedAndFile();
    }
    socket.send(JSON.stringify({operation: 'REFRESH', soundbites: podcasts}));

    socket.on('close', function () {
        console.log('Client disconnected: ' + address);
        connections.splice(connections.indexOf(socket), 1);
    });

    socket.on('error', function (reason, code) {
      console.log('socket error: reason ' + reason + ', code ' + code);
    });


    socket.on('message', function (data) {
        if (floodedBy(socket)) return;

        var packet;
        try {
            packet = JSON.parse(data);
        } catch (e) {
            console.log('error: malformed JSON message (' + e + '): '+ data);
            return;
        }

        if (packet.operation === 'PING') {
            socket.send(JSON.stringify({operation: 'PONG'}));
        } else if (packet.operation === 'COMMAND') {
            handleAdminCommand(packet['id']);
        	socket.send(JSON.stringify({operation: 'CMDREPLY'}));
        } else {
            console.log("Don't know what to do with " + packet['operation']);
        }
    });
});
