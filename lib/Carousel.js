const
  DEFAULT_REQUEST_TIMEOUT = 61000,
  DEFAULT_MIN_REQUEST_INTERVAL = 200;

var
  os = require('os'),
  http = require('http'),
  urlLib = require('url'),
  Queue = require('./Queue');

module.exports = Carousel;

function Carousel(options) {
  this.options = options || {};

  this._parallel = this.options.parallel || os.cpus().length * 2;
  this._requestTimeout = this.options.requestTimeout || DEFAULT_REQUEST_TIMEOUT;
  this._minRequestInterval = this.options.minRequestInterval || DEFAULT_MIN_REQUEST_INTERVAL;
  this._impressForce = typeof this.options.impressForce == 'undefined' || this.options.impressForce;

  this._init();
}

Carousel.prototype = {

  _init: function() {
    this._queue = new Queue(this.options);
  },

  _startRequest: function() {
    var
      self = this,
      requestOptions,
      url,
      parsedUrl,
      req,
      timeoutId,
      timeStart;

    if (!this._queue.size()) {
      return;
    }

    url = this._queue.pop();
    if (!url) {
      next();
      return;
    }

    timeStart = Date.now();
    parsedUrl = urlLib.parse(url);

    if (parsedUrl.protocol && parsedUrl.protocol != 'http:') {
      console.error('Error url "'+url+'" unsupported protocol');
      next();
      return;
    }

    requestOptions = {
      host: parsedUrl.hostname,
      path: parsedUrl.path,
      headers: {
        "accept-encoding": 'gzip, deflate'
      }
    };
    if (parsedUrl.port) {
      requestOptions.port = parsedUrl.port;
    }
    if (this._impressForce) {
      requestOptions.headers['impress-force'] = 'on';
    }

    startTimeout();

    req = http.get(requestOptions);
    req
      .on('error', errorHandler)
      .on('response', function(res) {
        var
          time,
          contentLength = 0;

        res
          .on('data', function(chunk) {
            if (chunk && typeof chunk == 'object' && chunk.length) {
              contentLength += chunk.length;
            }
          })
          .on('end', function() {
            time = Date.now() - timeStart;

            if (res.statusCode == 200) {
              console.log('Ok "'+url+'"', time, 'ms', 'content length', contentLength, 'queue', self._queue.size());
              next();
              return;
            }
            if (res.statusCode == 404) {
              console.warn('Warn not found "'+url+'"', time, 'ms', 'content length', contentLength, 'queue', self._queue.size());
              next();
              return;
            }
            console.error('Fail request "'+url+'" with status code', res.statusCode, time, 'ms', 'content length', contentLength, 'queue', self._queue.size());
            next();
          })
          .on('error', errorHandler);
      });

    function startTimeout() {
      cancelTimeout();
      timeoutId = setTimeout(
        function() {
          console.error('Fail request "'+url+'" timeout', self._requestTimeout);
          next();
        },
        self._requestTimeout
      )
    }

    function cancelTimeout() {
      timeoutId && clearTimeout(timeoutId);
      timeoutId = null;
    }

    function errorHandler(error) {
      console.error('Fail request "'+url+'"', error);
      next();
    }

    function next() {
      cancelTimeout();
      setTimeout(
        function() {
          self._startRequest();
        },
        Math.max(0, self._minRequestInterval + timeStart - Date.now())
      );
    }
  },

  _start: function() {
    var
      index;

    for(index = 0; index < this._parallel; index++) {
      this._startRequest();
    }
  },

  run: function() {
    var
      self = this,
      ready;
    ready = this._queue.prepare();
    ready.then(function() {
      self._start();
    });
    ready.catch(function(error) {
      console.log('Queue prepare error', error);
    });
  }

};