const { expect } = require('chai');
const { test } = require('./utils/browser');
const fs = require('fs');
const launcher = require('./launcher');

const deferJSFile = process.env.DEFER_FILE || 'js_defer.js';

describe('deferjs', () => {
  it(
    'should defer script execution after images load',
    test(async browser => {
      const [referenceRequests, deferedRequests] = await launcher.testSameBehavior(browser, 'defer_javascript.html');

      expect(referenceRequests.slice(2)).to.eql([
        `file://${__dirname}/assets/Puzzle.jpg`,
        `file://${__dirname}/assets/js_push1.js`,
        `file://${__dirname}/assets/BikeCrashIcn.png`,
        `file://${__dirname}/assets/js_push2.js`,
        `file://${__dirname}/assets/Cuppa.png`,
      ]);

      const libFolder = __dirname.replace('/tests', '/lib');

      expect(deferedRequests.slice(2)).to.eql([
        `file://${__dirname}/assets/Puzzle.jpg`,
        `file://${__dirname}/assets/BikeCrashIcn.png`,
        `file://${__dirname}/assets/Cuppa.png`,
        `file://${libFolder}/${deferJSFile}`,
        `file://${__dirname}/assets/js_push1.js`,
        `file://${__dirname}/assets/js_push2.js`,
      ]);
    })
  );

  it(
    'should load scripts tag after exceptions in external or inlined scripts',
    test(async browser => {
      try {
        await launcher.testSameBehavior(browser, 'js_exception.html');
      } catch (err) {
        expect(err).to.match(/.*ReferenceError: Foo.*/);
      }
    })
  );

  it(
    'should continue to load script in case of 404 error',
    test(async browser => {
      try {
        await launcher.testSameBehavior(browser, '404.html');
      } catch (err) {
        expect(err).to.match(/.*ERR_FILE_NOT_FOUND.*/);
      }
    })
  );

  it(
    'should trigger window and document event',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'browser_event.html');
    })
  );

  it(
    'should not fail when there is multiple body',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'multiple_body.html');
    })
  );

  it(
    'should execute scripts in the right order for dynamic insertion via insertBefore',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'order_insertBefore.html');
    })
  );

  it(
    'should ensure that the insertion order in the output is maintained via inlined insertion.',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'order_inline.html');
    })
  );

  it(
    'should ensure that the insertion order in the output is maintained with external script',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'order_ext.html');
    })
  );

  it(
    'should execute scripts in the right order for dynamic insertion via appendChild',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'order_createElement.html');
    })
  );

  it(
    'should ensure that the insertion order in the output is maintained when some scripts are inserted on the page via multiple document.write.',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'order_document_write.html');
    })
  );

  it(
    'should ensure that onloads event is emitted.',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'onload_attribute_in_html.html');
    })
  );

  it(
    'should trigger the window.onload if a script is inserted by jquery',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'jquery_append_script.html');
    })
  );

  it(
    'should wait to execute script until the window.preventDeferJSStart equals 0',
    test(async browser => {
      const deferedFile = `${__dirname}/tmp/defered-test_preventDeferJSStart.html`;

      launcher.generateDeferVersion(`${__dirname}/reference/test_preventDeferJSStart.html`, deferedFile);

      await launcher.executeTest(browser, deferedFile);
    })
  );

  it(
    'should dynamically insert the script with original attribute',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'defer_insertion.html');
    })
  );

  it(
    'should trigger the window.onload if a script is inserted by createElementNS',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'test_dynamic_element_via_createElementNS.html');
    })
  );

  it(
    'should not trigger the document.onload event',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'jquery_document_load.html');
    })
  );

  it(
    'should dynamically insert the script with async defer',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'defer_async.html');
    })
  );

  it(
    'should execute scripts with defer attribute after blocking scripts.',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'defer_order.html');
    })
  );

  it(
    'should execute async scripts after jquery document onload.',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'jquery_document_load_async.html');
    })
  );

  it(
    'should insert inline scripts at the right place.',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'insertion_order_async.html');
    })
  );

  it(
    'should load script even when there is body.innerHTML',
    test(async browser => {
      await launcher.testSameBehavior(browser, 'body_innerhtml.html');
    })
  );

  it(
    'should not change break inlined script in page with custom encoding on firefox',
    test(async browser => {
      await launcher.testSameBehavior(
        browser,
        'encoding_firefox.html',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:64.0) Gecko/20100101 Firefox/64.0',
        'iso-8859-15'
      );
    })
  );
});
