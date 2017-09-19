const { expect } = require('chai');
const { test } = require('./utils/browser');
const fs = require('fs');

const deferJSFile = process.env.DEFER_FILE || 'js_defer.js';

describe('deferjs', () => {

  function generateDeferVersion(file, deferedFile) {
    let html = fs.readFileSync(file, 'utf-8');
    html = html.replace(/<script type="application\/javascript"/g, '<script type="text/frzjs"');
    html = html.replace(/script type="text\/frzjs" src="/g, 'script type="text/frzjs" frz_orig_src="');
    html = html.replace(/onload="/g, 'onload="var e=this;if (this==window) e=document.body;e.setAttribute(\'data-frz-loaded\', 1);" data-frz-onload="');
    html = html.replace('</body>', '<script type="text/javascript" src="../../lib/' + deferJSFile + '"></script></body>');
    fs.writeFileSync(deferedFile, html);
  }

  async function gotoPage(browser, file) {
    const jsExceptions = [];
    const requestfailed = [];
    const requests = [];
    const page = await browser.newPage();
    page.on('pageerror', (error) => {
      jsExceptions.push(error.message);
    });

    page.on('requestfailed', (request) => {
      requestfailed.push(request.url);
    });

    page.on('request', (request) => {
      requests.push(request.url);
    });

    await page.goto('file:' + file);

    const output = await page.evaluate(() => {
      return window.output;
    });
    return [output, jsExceptions, requestfailed, requests];
  }

  async function testSameBehavior(browser, fileName, expectedOutput, jsExceptionsNumber=0, requestFailedNumber=0) {
    const referenceFile = `${__dirname}/reference/${fileName}`;
    const deferedFile = `${__dirname}/defered/${fileName}`;

    generateDeferVersion(referenceFile, deferedFile);

    const [referenceOutput, referenceJsExceptions, referenceRequestFailed] = await gotoPage(browser, referenceFile);
    const [deferedOutput, deferedJsExceptions, deferedRequestFailed] = await gotoPage(browser, deferedFile);
    expect(referenceOutput).to.eql(expectedOutput);
    expect(deferedOutput).to.eql(referenceOutput);

    expect(referenceJsExceptions).to.have.lengthOf(jsExceptionsNumber);
    expect(referenceRequestFailed).to.have.lengthOf(requestFailedNumber);
    expect(deferedRequestFailed).to.eql(referenceRequestFailed);

    return [referenceJsExceptions, deferedJsExceptions];
  }

  it('should defer script execution after images load', test(async (browser) => {
    const referenceFile = `${__dirname}/reference/defer_javascript.html`;
    const deferedFile = `${__dirname}/defered/defer_javascript.html`;

    generateDeferVersion(referenceFile, deferedFile);

    const [referenceOutput, referenceJsExceptions, referenceRequestFailed, referenceRequests] = await gotoPage(browser, referenceFile);
    const [deferedOutput, deferedJsExceptions, deferedRequestFailed, deferedRequests] = await gotoPage(browser, deferedFile);

    expect(referenceRequests).to.eql([
      `file://${__dirname}/reference/defer_javascript.html`,
      `file://${__dirname}/assets/Puzzle.jpg`,
      `file://${__dirname}/assets/js_push1.js`,
      `file://${__dirname}/assets/BikeCrashIcn.png`,
      `file://${__dirname}/assets/js_push2.js`,
      `file://${__dirname}/assets/Cuppa.png`
    ]);

    const libFolder = __dirname.replace('/tests', '/lib');

    expect(deferedRequests).to.eql([
      `file://${__dirname}/defered/defer_javascript.html`,
      `file://${__dirname}/assets/Puzzle.jpg`,
      `file://${__dirname}/assets/BikeCrashIcn.png`,
      `file://${__dirname}/assets/Cuppa.png`,
      `file://${libFolder}/${deferJSFile}`,
      `file://${__dirname}/assets/js_push1.js`,
      `file://${__dirname}/assets/js_push2.js`
    ]);
  }));

  it('should load scripts tag after exceptions in external or inlined scripts', test(async (browser) => {
    const [referenceJsExceptions, deferedJsExceptions] = await testSameBehavior(browser, 'js_exception.html', [1, 2], 2, 0);

    let [errorInExternalFile, errorInInlineFile] = referenceJsExceptions;
    expect(errorInExternalFile).to.match(new RegExp('ReferenceError: Foo is not defined\n    at file://' + __dirname + '/assets/js_defer_error.js'));
    expect(errorInInlineFile).to.match(new RegExp('ReferenceError: Foo is not defined\n    at file://'));

    [errorInExternalFile, errorInInlineFile] = deferedJsExceptions;
    expect(errorInExternalFile).to.match(new RegExp('ReferenceError: Foo is not defined\n    at file://' + __dirname + '/assets/js_defer_error.js'));
    expect(errorInInlineFile).to.match(new RegExp('ReferenceError: Foo is not defined\n    at <anonymous>'));
  }));

  it('should continue to load script in case of 404 error', test(async (browser) => {
    await testSameBehavior(browser, '404.html', [1, 2], 0, 1);
  }));

  it('should trigger window and document event', test(async (browser) => {
    await testSameBehavior(browser, 'browser_event.html', [
      "dom ready jquery",
      "dom ready",
      "window onload jquery",
      "window onload"
    ]);
  }));

  it('should not fail when there is multiple body', test(async (browser) => {
    await testSameBehavior(browser, 'multiple_body.html', [1, 2, 3]);
  }));

  it('should execute scripts in the right order for dynamic insertion via insertBefore', test(async (browser) => {
    await testSameBehavior(browser, 'order_insertBefore.html', [2, 3, 4, 4, 5]);
  }));

  it('should ensure that the insertion order in the output is maintained via inlined insertion.', test(async (browser) => {
    await testSameBehavior(browser, 'order_inline.html', [1, 2, 3]);
  }));

  it('should ensure that the insertion order in the output is maintained with external script', test(async (browser) => {
    await testSameBehavior(browser, 'order_ext.html', [1, 2, 3]);
  }));

  it('should execute scripts in the right order for dynamic insertion via appendChild', test(async (browser) => {
    await testSameBehavior(browser, 'order_createElement.html', [1, 2, 3]);
  }));

  it('should ensure that the insertion order in the output is maintained when some scripts are inserted on the page via multiple document.write.', test(async (browser) => {
    await testSameBehavior(browser, 'order_document_write.html', [1, 2, 3]);
  }));

  it('should ensure that onloads event is emitted.', test(async (browser) => {
    await testSameBehavior(browser, 'onload_attribute_in_html.html', [1, 2, 3]);
  }));
});
