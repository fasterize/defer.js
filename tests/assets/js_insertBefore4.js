var script = document.createElement("script");
script.setAttribute("src", "../assets/js_push4.js");
script.setAttribute("type", "text/javascript");
var node = document.getElementsByTagName("head")[0].children[0]; // #will-be-removed
var insertedElement = node.parentNode.insertBefore(script, node);
if (insertedElement != script) {
  document.writeln("inserted script should be returned even if the insertion is delayed");
  throw "inserted element should be returned";
}
var div = document.createElement("div");
var insertedElement = node.parentNode.insertBefore(div, node);
if (insertedElement != div) {
  document.writeln("inserted div should be returned");
  throw "inserted element should be returned";
}
