const { expect } = require('chai');
const { test } = require('./utils/browser');
const fs = require('fs');
const launcher = require('./launcher');

const deferJSFile = process.env.DEFER_FILE || 'js_defer.js';

describe('deferjs', () => {
  it('should defer script execution after images load', test(async (browser) => {
    const [referenceJsExceptions, deferedJsExceptions, referenceRequests, deferedRequests] = await launcher.testSameBehavior(browser, 'defer_javascript.html');

    expect(referenceRequests.slice(2)).to.eql([
      `file://${__dirname}/assets/Puzzle.jpg`,
      `file://${__dirname}/assets/js_push1.js`,
      `file://${__dirname}/assets/BikeCrashIcn.png`,
      `file://${__dirname}/assets/js_push2.js`,
      `file://${__dirname}/assets/Cuppa.png`
    ]);

    const libFolder = __dirname.replace('/tests', '/lib');

    expect(deferedRequests.slice(2)).to.eql([
      `file://${__dirname}/assets/Puzzle.jpg`,
      `file://${__dirname}/assets/BikeCrashIcn.png`,
      `file://${__dirname}/assets/Cuppa.png`,
      `file://${libFolder}/${deferJSFile}`,
      `file://${__dirname}/assets/js_push1.js`,
      `file://${__dirname}/assets/js_push2.js`
    ]);
  }));

  it('should load scripts tag after exceptions in external or inlined scripts', test(async (browser) => {
    const [referenceJsExceptions, deferedJsExceptions] = await launcher.testSameBehavior(browser, 'js_exception.html', true);

    let [errorInExternalFile, errorInInlineFile] = referenceJsExceptions;
    expect(errorInExternalFile).to.match(/.*ReferenceError: Foo is not defined.*/);
    expect(errorInInlineFile).to.match(/.*ReferenceError: FooInline is not defined.*/);

    [errorInExternalFile, errorInInlineFile] = deferedJsExceptions;
    expect(errorInExternalFile).to.match(/.*ReferenceError: Foo is not defined.*/);
    expect(errorInInlineFile).to.match(/.*ReferenceError: FooInline is not defined.*/);
  }));

  it('should continue to load script in case of 404 error', test(async (browser) => {
    await launcher.testSameBehavior(browser, '404.html', false, 1);
  }));

  it('should trigger window and document event', test(async (browser) => {
    await launcher.testSameBehavior(browser, 'browser_event.html', [
      "dom ready jquery",
      "dom ready",
      "window onload jquery",
      "complete"
    ]);
  }));

  it('should not fail when there is multiple body', test(async (browser) => {
    await launcher.testSameBehavior(browser, 'multiple_body.html');
  }));

  it('should execute scripts in the right order for dynamic insertion via insertBefore', test(async (browser) => {
    await launcher.testSameBehavior(browser, 'order_insertBefore.html');
  }));

  it('should ensure that the insertion order in the output is maintained via inlined insertion.', test(async (browser) => {
    await launcher.testSameBehavior(browser, 'order_inline.html');
  }));

  it('should ensure that the insertion order in the output is maintained with external script', test(async (browser) => {
    await launcher.testSameBehavior(browser, 'order_ext.html');
  }));

  it('should execute scripts in the right order for dynamic insertion via appendChild', test(async (browser) => {
    await launcher.testSameBehavior(browser, 'order_createElement.html');
  }));

  it('should ensure that the insertion order in the output is maintained when some scripts are inserted on the page via multiple document.write.', test(async (browser) => {
    await launcher.testSameBehavior(browser, 'order_document_write.html');
  }));

  it('should ensure that onloads event is emitted.', test(async (browser) => {
    await launcher.testSameBehavior(browser, 'onload_attribute_in_html.html');
  }));

  it('should trigger the window.onload if a script is inserted by jquery', test(async (browser) => {
    await launcher.testSameBehavior(browser, 'jquery_append_script.html');
  }));

  it('should wait to execute script until the window.preventDeferJSStart equals 0', test(async (browser) => {
    const deferedFile = `${__dirname}/tmp/defered-test_preventDeferJSStart.html`;

    launcher.generateDeferVersion(`${__dirname}/reference/test_preventDeferJSStart.html`, deferedFile);

    await launcher.executeTest(browser, deferedFile);
  }));

  it('should dynamically insert the script with original attribute', test(async (browser) => {
    await launcher.testSameBehavior(browser, 'defer_insertion.html', [1, "../assets/js_push2.js"]);
  }));
});
