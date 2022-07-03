# Soundbitten (Node)

Release Notes: v0.1 3rd July, 2022

This is a rather roughly written NodeJS server application that's designed to be the interface between a common file system and a single (or multiple) clients, collaboratively working on Soundbites. That said, in its current revision (v0.1) it's a bare-bones proof of concept to illustrate what's possible rather than a polished final product.

My attempts to get this working on Heroku failed so I'm temporarily hosting this on my own VPS. We'll see how long that lasts but with write down to disk effectively not available it serves as a test read-only data source for this demonstration.

Alternatively install NodeJS on your local machine, noting the dependancies: npm install
(jsdom, node-fetch-commonjs, query-selector, ws)

Tested and working on NodeJS v18.3.0 and v16.14.2

To run from command line:

- [Local] npm start
- [Server] NODE_ENV='production' node soundbitten.js

**Setting up for your installation**

Modify the "folderLocalPath" [Local] or "folderServerPath" [Server] to where you're keeping your Soundbite per episode files. Example files are in this repo under /soundbites. Each directory must have an index.json that contains the Show Title and RSS URL. Soundbite per episode files are named x.json where x is the number of the episode. (eg: 1.json = Episode 1, 5.json = Episode 5)

If you want to run it on your own server then its better to daemonise the process. I trust you know how to do that yourselves for other platforms but if you want, I've shared my Alpine init.d script under /scripts/soundbitten

**Managing Soundbites**

The client application (Demo here: https://johnchidgey.github.io/managesoundbites.html) requires this NodeJS server to be running to function.

**Future Feature/Wish List**

- Direct Server submission of listener Soundbites
- File system watcher with auto-refresh for file changes (currently have to restart process to pick up file system changes)

**Related Links**

- Demo website: https://johnchidgey.github.io/managesoundbites.html
- Demo Repo: https://github.com/johnchidgey/johnchidgey.github.io
- NameSpace Proposal for improved Soundbites: https://github.com/Podcastindex-org/podcast-namespace/issues/61
