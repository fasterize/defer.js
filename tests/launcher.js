const { expect } = require('chai');
const { test } = require('./utils/browser');
const fs = require('fs');

const deferJSFile = process.env.DEFER_FILE || 'js_defer.js';

module.exports = {
  testSameBehavior,
  executeTest,
  generateDeferVersion
}

function generateDeferVersion(file, deferedFile) {
  let html = fs.readFileSync(file, 'utf-8');
  html = html.replace(/<script type="application\/javascript"/g, '<script type="text/frzjs"');
  html = html.replace(/script type="text\/frzjs" src="/g, 'script type="text/frzjs" frz_orig_src="');
  html = html.replace(/onload="/g, 'onload="var e=this;if (this==window) e=document.body;e.setAttribute(\'data-frz-loaded\', 1);" data-frz-onload="');
  html = html.replace('</body>', '<script type="text/javascript" src="../../lib/' + deferJSFile + '"></script></body>');

  fs.writeFileSync(deferedFile, html);

  generateInstrumentedVersion(deferedFile, deferedFile);
}

function generateInstrumentedVersion(file, referenceFile) {
  let html = fs.readFileSync(file, 'utf-8');
  html = html.replace("</head>", `
    </head>
    <script src="../../node_modules/chai/chai.js"></script>
    <script>
      var expect = chai.expect;
      window.onerror = function myErrorHandler(errorMsg, url, lineNumber) {
        console.error("error", errorMsg, window.location.href);
        console.log("done");
      }
      function done(assertion) {
        window.onload = function () {
          setTimeout(function () {
            assertion();
            console.log("done");
          },100);
        }
      }
    </script>`);
  fs.writeFileSync(referenceFile, html);
}

async function gotoPage(browser, file, waitUntil='networkidle') {
  const jsExceptions = [];
  const failedRequests = [];
  const requests = [];
  let ended = false;
  const page = await browser.newPage();
  page.on('requestfailed', (request) => {
    failedRequests.push(request.url);
  });

  page.on('request', (request) => {
    requests.push(request.url);
  });

  page.on('console', (type, errorMsg, url) => {
    if (type === 'done') {
      ended = true;
    }
    else {
      jsExceptions.push(`${url} : ${errorMsg}`);
    }
  });

  await page.goto('file:' + file, {waitUntil, networkIdleTimeout: 300});

  return [ended, jsExceptions, failedRequests, requests];
}

async function executeTest(browser, file, ignoreException=false, requestFailedNumber=0) {
  const [testEnded, jsExceptions, failedRequests, requests] = await gotoPage(browser, file);
  if (!ignoreException) {
    if (jsExceptions.length > 0) {
      jsExceptions.forEach((exception) => {
        throw new Error(exception);
      });
    }
  }

  expect(testEnded, `test ${file} didn't ended correctly. Don't forget to call done() at the end`).to.be.true;
  expect(failedRequests).to.have.lengthOf(requestFailedNumber);
  return [jsExceptions, requests];
}

async function testSameBehavior(browser, fileName, ignoreException=false, requestFailedNumber=0) {
  const referenceFile = `${__dirname}/tmp/reference-${fileName}`;
  const deferedFile = `${__dirname}/tmp/defered-${fileName}`;

  generateDeferVersion(`${__dirname}/reference/${fileName}`, deferedFile);
  generateInstrumentedVersion(`${__dirname}/reference/${fileName}`, referenceFile);

  const [referenceJsExceptions,referenceRequests] = await executeTest(browser, referenceFile, ignoreException, requestFailedNumber);
  const [deferedJsExceptions,deferedRequests] = await executeTest(browser, deferedFile, ignoreException, requestFailedNumber);

  return [referenceJsExceptions, deferedJsExceptions, referenceRequests, deferedRequests];
}
