#!/usr/bin/env node

'use strict';

var
  Application = require('../lib/Application'),
  yargs = require('yargs'),

  argv = yargs
    .usage('Usage: $0 [config.json[, ...config.json]] [options]')
    .describe('impresser-host', 'Host of impresser server by default localhost:8497')
    .describe('impresser-frontend', 'Impresser server launched as frontend by default true')
    .describe('parallel', 'Count of parallels requests by default 2 on each CPU cores')
    .describe('request-timeout', 'Request timeout by default 61000')
    .describe('min-request-interval', 'Minimum request interval by default 1000')
    .describe('sitemap', 'Url to sitemap xml file, can be multiple')
    .describe('shuffle', 'Shuffle sitemaps urls by default true')
    .describe('site-host', 'Host of target site by default icons8.com')
    .describe('impress-force', 'Use impress-force header for force cache updating by default true')
    .describe('config', 'Path to config file, can be multiple')
    .help('h')
    .alias('h', 'help')
    .epilog('impresser-warm (https://github.com/icons8/impresser-warm)')
    .argv,

  options;

options = argv;
options.config = argv._.concat(options.config);

new Application(options).run();
