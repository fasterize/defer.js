const { expect } = require('chai');
const { test } = require('./utils/browser');
const fs = require('fs');

const deferJSFile = process.env.DEFER_FILE || 'js_defer.js';

module.exports = {
  testSameBehavior,
  executeTest,
  generateDeferVersion,
};

function generateDeferVersion(file, deferedFile) {
  let html = fs.readFileSync(file, 'utf-8');
  html = html.replace(/<script type="application\/javascript"/g, '<script type="text/frzjs"');
  html = html.replace(/script type="text\/frzjs" src="/g, 'script type="text/frzjs" frz_orig_src="');
  html = html.replace(
    /onload="/g,
    'onload="var e=this;if (this==window) e=document.body;e.setAttribute(\'data-frz-loaded\', 1);" data-frz-onload="'
  );
  html = html.replace('</body>', '<script type="text/javascript" src="../../lib/' + deferJSFile + '"></script></body>');

  fs.writeFileSync(deferedFile, html);

  generateInstrumentedVersion(deferedFile, deferedFile);
}

function generateInstrumentedVersion(file, referenceFile) {
  let html = fs.readFileSync(file, 'utf-8');
  html = html.replace(
    '</head>',
    `
    </head>
    <script src="../../node_modules/chai/chai.js"></script>
    <script>
      var expect = chai.expect;
      window.onerror = function myErrorHandler(errorMsg, url, lineNumber) {
        console.error("error", errorMsg, window.location.href);
        console.log("done");
      }
      function done(assertion, waitLoadTime=true) {
        if (waitLoadTime) {
          window.onload = function () {
            setTimeout(function () {
              assertion();
              console.log("done");
            },100);
          }
        }
        else {
          console.log("done");
        }
      }
    </script>`
  );
  fs.writeFileSync(referenceFile, html);
}

async function gotoPage(browser, file) {
  const consoleMsg = [];
  const jsExceptions = [];
  const failedRequests = [];
  const requests = [];
  let ended = false;
  const page = await browser.newPage();
  page.on('request', request => {
    requests.push(request.url());
  });

  page.on('pageerror', error => {
    jsExceptions.push(error);
  });

  page.on('console', msg => {
    if (msg.text() === 'done') {
      ended = true;
    }
  });

  await page.goto('file:' + file, { waitUntil: 'networkidle0' });
  jsExceptions.forEach(exception => {
    throw exception;
  });
  return [ended, requests];
}

async function executeTest(browser, file) {
  const [testEnded, requests] = await gotoPage(browser, file);
  expect(testEnded, `test ${file} didn't ended correctly. Don't forget to call done() at the end`).to.be.true;
  return [requests];
}

async function testSameBehavior(browser, fileName) {
  const referenceFile = `${__dirname}/tmp/reference-${fileName}`;
  const deferedFile = `${__dirname}/tmp/defered-${fileName}`;

  generateDeferVersion(`${__dirname}/reference/${fileName}`, deferedFile);
  generateInstrumentedVersion(`${__dirname}/reference/${fileName}`, referenceFile);

  const [referenceRequests] = await executeTest(
    browser,
    referenceFile
  );
  const [deferedRequests] = await executeTest(
    browser,
    deferedFile
  );
  return [referenceRequests, deferedRequests];
}
