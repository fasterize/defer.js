var test = require('testling');

test('JS execution order is ok with deferred tags', function (t) {
  t.createWindow('http://tunnel.browserling.com:53985/deferred.html', function(win, $) {

    // we cannot use window onload event
    // even with this hack, IE8.0 fails to test on testling
    setTimeout(function () {
      t.deepEqual(win.testarray, [0,1,2,3,4], 'Array order is preserved');
      t.ok(win.loadcb, 'Window load callback fire');
      t.ok(win.domreadycb, 'Domready callback fire');
      t.end();
    }, 1000);

  });
});
