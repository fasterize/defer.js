var test = require('testling');

test('JS execution order is ok without deferred tags', function (t) {
  t.createWindow('http://tunnel.browserling.com:53985/standard.html', function(win, $) {
    t.deepEqual(win.testarray, [0,1,2,3,4], 'Array order is preserved');
    t.end();
  });
});
