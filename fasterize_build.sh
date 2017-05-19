#!/bin/sh

./node_modules/.bin/uglifyjs -m --screw-ie8 --no-copyright lib/js_defer.js > lib/js_defer-min.js
