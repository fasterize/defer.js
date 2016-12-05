var fs = require('fs');
module.exports.content = fs.readFileSync(__dirname + '/lib/js_defer-min.js');
module.exports.lmt = fs.statSync(__dirname + '/lib/js_defer-min.js').mtime.toUTCString();
