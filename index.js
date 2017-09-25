var crypto = require('crypto');
var fs = require('fs');

var scriptProd = fs.readFileSync(__dirname + '/lib/js_defer-min.js', 'utf-8');
var md5Prod = crypto.createHash('md5').update(scriptProd).digest("hex");

var scriptDebug = fs.readFileSync(__dirname + '/lib/js_defer.js', 'utf-8');
var md5Debug = crypto.createHash('md5').update(scriptDebug).digest("hex");

module.exports = {
  debug: {
    script: scriptDebug,
    md5: md5Debug
  },
  prod: {
    script: scriptProd,
    md5: md5Prod
  }
};
