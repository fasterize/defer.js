var test = require('testling');

test('array order', function (t) {
  t.createWindow('http://tunnel.browserling.com:53985/simple.html', function(win, $) {
    t.deepEqual(win.testarray, [0,1,2], 'Array order is preserved');
    t.end();
  });
})
