#!/bin/sh

./node_modules/.bin/uglifyjs --compress --mangle --mangle-props reserved=['psaFunc','fasterizeNs','deferJs','logs','preventDeferJSStart'] -- lib/js_defer.js > lib/js_defer-min.js
