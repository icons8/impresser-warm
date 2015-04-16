#!/usr/bin/env node

'use strict';

var
  Application = require('../lib/Application'),
  yargs = require('yargs'),

  argv = yargs
    .usage('Usage: $0 [options]')
    .describe('impress-host', 'Host of impress server by default localhost:8497')
    .describe('parallel', 'Count of parallels requests by default 2 on each CPU cores')
    .describe('request-timeout', 'Request timeout by default 61000')
    .describe('min-request-interval', 'Minimum request interval by default 1000')
    .describe('sitemap', 'Url to sitemap xml file, can be multiple')
    .describe('site-host', 'Host of target site by default icons8.com')
    .describe('config', 'Path to config file, can be multiple')
    .help('h')
    .alias('h', 'help')
    .epilog('impress-warm (https://github.com/icons8/impress-warm)')
    .argv;

new Application(argv).run();
