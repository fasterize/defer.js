defer.js
========

Defer javascript using modified google pagespeed deferjs


## Running tests

```bash
npm install -g testling http-server
```

We will run a local http-server in tests/assets/ that will be tunneled to testling

* Start your http-server : `http-server tests/assets/`
* Register an account on http://www.testling.com
* Register your public key on testling : `curl -u you@mail.com -sST ~/.ssh/id_rsa.pub testling.com/tunnel`
* Open tunnel : `ssh -NR 53985:localhost:8080 your_mail_com@tunnel.browserling.com`
* Launch tests : `curl -u you@mail.com -sSNT *.js "testling.com/?browsers=iexplore/8.0,chrome/17.0,firefox/10.0,safari/5.1"`

## Licence

(The MIT Licence)

Copyright (c) 2012 Vincent Voyer

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
