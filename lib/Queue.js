const
  DEFAULT_SITE_HOST = 'icons8.com',
  DEFAULT_IMPRESS_HOST = 'localhost:8497';

var
  Promise = require('bluebird'),
  http = require("http"),
  zlib = require("zlib"),
  fs = require('fs'),
  htmlparser = require("htmlparser2");

module.exports = Queue;

function Queue(options) {
  this.options = options || {};

  this._siteHost = this.options.siteHost || DEFAULT_SITE_HOST;
  this._impressHost = this.options.impressHost || DEFAULT_IMPRESS_HOST;
  this._remoteSitemaps = [];

  this._queue = [];
  this._init();
}

Queue.prototype = {

  _init: function() {
    if (this.options.sitemap) {
      this.addSitemapByUrl(this.options.sitemap);
    }
  },

  size: function() {
    return this._queue.length;
  },

  pop: function() {
    return this._queue.shift();
  },

  addSitemapByUrl: function(url) {
    Array.prototype.push.apply(
      this._remoteSitemaps,
      Array.isArray(url)
        ? url
        : [url]
    );
  },

  addUrl: function(url) {
    var
      siteHost = this._siteHost,
      impressHost = this._impressHost;

    url = String(url || '');
    if (url.match(new RegExp('^https?:\/\/' + regExpQuote(siteHost), 'i'))) {
      url = url
        .replace(/^(https?:\/\/)(.+?)([?/#]|$)/i, function(match, prefix, host, suffix) {
          return prefix + impressHost + suffix;
        })
        .replace(/^([^#?]+)([^#]*)(#!?)/, function(match, prefix, query, sharp) {
          return query
            ? prefix + query + '&_escaped_fragment_='
            : prefix + '?_escaped_fragment_=';
        });
      this._queue.push(url);
    }

    function regExpQuote(str) {
      // @see http://phpjs.org/functions/preg_quote/
      return String(str || '').replace(/[.\\+*?\[\^\]$(){}=!<>|:-]/g, '\\$&');
    }
  },

  _performSitemapXml: function(xml) {
    var
      self = this,
      parser,
      reading;

    parser = new htmlparser.Parser({
      onopentag: function(name) {
        if (name == 'loc') {
          reading = true;
        }
      },
      ontext: function(text){
        if (reading) {
          self.addUrl(text);
        }
      },
      onclosetag: function(name){
        if (name == 'loc') {
          reading = false;
        }
      }
    });
    parser.write(xml);
    parser.end();
  },

  _performSitemapByUrl: function(url) {
    var
      self = this;

    return Promise.fromNode(
      function(callback) {
        var
          buffer = [];

        console.log('Sitemap request', url);
        http.get(url, function(res) {
          var
            gzipped,
            deflated,
            stream;

          gzipped = /\.gz$/i.test(url) || /gzip/i.test(res.headers['content-encoding']);
          deflated = /deflate/i.test(res.headers['content-encoding']);

          if (gzipped) {
            stream = zlib.createGunzip();
            res.pipe(stream);
          }
          else if (deflated) {
            stream = zlib.createInflate();
            res.pipe(stream);
          }
          else {
            stream = res;
          }

          stream
            .on('data', function(data) {
              buffer.push(data.toString())
            })
            .on('end', function() {
              callback(null, buffer.join(''));
            })
            .on('error', callback);

        }).on('error', callback);

      })
      .then(function(data) {
        console.log('Sitemap processing', url);
        return self._performSitemapXml(data);
      });
  },

  prepare: function() {
    var
      self = this;
    return Promise.all(
      this._remoteSitemaps.map(function(url) {
        return self._performSitemapByUrl(url);
      })
    )
      .then(function() {
        return self;
      });
  }

};