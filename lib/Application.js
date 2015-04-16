var
  fs = require('fs'),
  merge = require('merge'),
  Carousel = require('./Carousel');

module.exports = Application;

function Application(options) {
  this.options = options || {};
}

Application.prototype = {

  _init: function() {
    if (this.options.config) {
      this.addConfig(this.options.config);
    }
  },

  addConfig: function(config) {
    var
      self = this;

    if (!Array.isArray(config)) {
      config = [config];
    }

    config.forEach(function(config) {
      if (typeof config != 'string') {
        _merge(config);
        return;
      }
      try {
        _merge(
          JSON.parse(
            fs.readFileSync(config)
          )
        );
      }
      catch(error) {
        console.error(error);
      }
    });

    function _merge(config) {
      if (!config || typeof config != 'object') {
        return;
      }
      merge.recursive(self.options, config);
    }

    return this;
  },

  run: function() {
    new Carousel(this.options).run();
  }

};