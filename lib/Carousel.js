const
  DEFAULT_REQUEST_TIMEOUT = 61000,
  DEFAULT_MIN_REQUEST_INTERVAL = 1000;

var
  os = require('os'),
  request = require('request'),
  Queue = require('./Queue');

module.exports = Carousel;

function Carousel(options) {
  this.options = options || {};

  this._concurrent = this.options.concurrent || 2 * os.cpus().length;
  this._requestTimeout = this.options.requestTimeout || DEFAULT_REQUEST_TIMEOUT;
  this._minRequestInterval = this.options.minRequestInterval || DEFAULT_MIN_REQUEST_INTERVAL;

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
      timeStart = Date.now();

    url = this._queue.pop();
    if (!url) {
      return;
    }

    requestOptions = {
      url: url,
      timeout: this._requestTimeout
    };

    request(requestOptions, function(err, res) {
      var
        time = Date.now() - timeStart;

      if (err) {
        console.error('Fail request "'+url+'" with error', err, time, 'ms', 'queue', self._queue.size());
        next();
        return;
      }
      if (res.statusCode == 200) {
        console.log('Ok "'+url+'"', time, 'ms', 'queue', self._queue.size());
        next();
        return;
      }
      if (res.statusCode == 404) {
        console.warn('Warn not found "'+url+'"', time, 'ms', 'queue', self._queue.size());
        next();
        return;
      }

      console.error('Fail request "'+url+'" with status code', res.statusCode, time, 'ms', 'queue', self._queue.size());
      next();
    });

    function next() {
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

    for(index = 0; index < this._concurrent; index++) {
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