const
  DEFAULT_SITE_HOST = 'icons8.com';

var
  Promise = require('bluebird'),
  http = require('http'),
  zlib = require('zlib'),
  path = require('path'),
  fs = require('fs'),
  parse5 = require('parse5');

module.exports = Queue;

function Queue(options) {
  this.options = options || {};

  this._siteHost = options.siteHost || DEFAULT_SITE_HOST;
  this._impresserHost = options.impresserHost;
  this._impresserFrontend = options.impresserFrontend;
  this._shuffle = typeof options.shuffle == 'undefined' || options.shuffle;

  this._sitemaps = [];

  this._queue = [];
  this._init();
}

Queue.prototype = {

  _init: function() {
    if (this.options.sitemap) {
      this.addSitemap(this.options.sitemap);
    }
  },

  size: function() {
    return this._queue.length;
  },

  pop: function() {
    return this._queue.shift();
  },

  addSitemap: function(url) {
    Array.prototype.push.apply(
      this._sitemaps,
      Array.isArray(url)
        ? url
        : [url]
    );
  },

  addUrl: function(url) {
    var
      siteHost = this._siteHost,
      impressHost = this._impresserHost,
      impressFrontend = this._impresserFrontend;

    url = String(url || '');
    if (url.match(new RegExp('^https?:\/\/' + regExpQuote(siteHost), 'i'))) {
      if (impressFrontend) {
        url = url
          .replace(/^(https?:\/\/)(.+?)([?/#]|$)/i, function(match, prefix, host, suffix) {
            return prefix + impressHost + suffix;
          });
      }
      url = url
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

    parser = new parse5.SimpleApiParser({
      startTag: function(tagName) {
        if (tagName == 'loc') {
          reading = true;
        }
      },
      text: function(text){
        if (reading) {
          self.addUrl(text);
        }
      },
      endTag: function(tagName){
        if (tagName == 'loc') {
          reading = false;
        }
      }
    });
    parser.parse(xml);
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

  _performSitemapByPath: function(filename) {
    var
      self = this;

    filename = path.normalize(filename);
    return Promise.fromNode(
      function(callback) {
        fs.readFile(filename, {encoding: 'utf8'}, callback);
      })
      .then(function(data) {
        console.log('Sitemap processing', filename);
        return self._performSitemapXml(data);
      });
  },

  _doShuffle: function() {
    console.log('Shuffling...');
    shuffleArray(this._queue);

    /**
     * @see http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
     * Randomize array element order in-place.
     * Using Fisher-Yates shuffle algorithm.
     */
    function shuffleArray(array) {
      for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
      }
      return array;
    }
  },

  prepare: function() {
    var
      self = this;
    return Promise.all(
      this._sitemaps.map(function(url) {
        return /^https?:/i.test(url)
          ? self._performSitemapByUrl(url)
          : self._performSitemapByPath(url);
      })
    )
      .then(function() {
        if (self._shuffle) {
          self._doShuffle();
        }
        console.log('Queue prepared');
        return self;
      });
  }

};