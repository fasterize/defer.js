#!/bin/sh

./node_modules/.bin/uglifyjs -m --no-copyright lib/js_defer.js > lib/js_defer-min.js
