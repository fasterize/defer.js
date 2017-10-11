var script = document.createElementNS("http://www.w3.org/1999/xhtml", "script");
script.setAttribute("src", "../assets/js_push1.js");
script.setAttribute("type", "text/javascript");
var node = document.getElementsByTagName("head")[0].children[0]; // #will-be-removed
node.parentNode.insertBefore(script, node);
