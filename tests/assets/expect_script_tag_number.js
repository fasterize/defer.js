var scripts = document.getElementsByTagName('SCRIPT');
if (scripts.length === 7) {
  expect(scripts[scripts.length - 1]).to.eql(document.getElementById('done'));
}
else {
  // case when js_defer is the last script
  expect(scripts[scripts.length - 2]).to.eql(document.getElementById('done'));
}
