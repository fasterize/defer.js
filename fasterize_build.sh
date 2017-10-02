#!/bin/sh

./node_modules/.bin/uglifyjs --warn --compress --mangle --mangle-props reserved=['psaFunc','fasterizeNs','deferJs','logs','preventDeferJSStart','configurable'] -- lib/js_defer.js > lib/js_defer-min.js
