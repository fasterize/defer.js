/*
 * Copyright 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Code for deferring javascript on client side.
 * This javascript is part of JsDefer filter.
 *
 * @author atulvasu@google.com (Atul Vasu)
 * @author ksimbili@google.com (Kishore Simbili)
 */

var fasterizeutils = {addHandler:function(elem, eventName, func) {
  if(elem.addEventListener) {
    elem.addEventListener(eventName, func, !1)
  }else {
    if(elem.attachEvent) {
      elem.attachEvent("on" + eventName, func)
    }else {
      var oldHandler = elem["on" + eventName];
      elem["on" + eventName] = function() {
        func.call(this);
        oldHandler && oldHandler.call(this)
      }
    }
  }
}};

/**
 * Exporting functions using quoted attributes to prevent js compiler from
 * renaming them.
 * See http://code.google.com/closure/compiler/docs/api-tutorial3.html#dangers
 */
window['fasterize'] = window['fasterize'] || {};
var fasterize = window['fasterize'];

fasterize['deferJsNs'] = {};
var deferJsNs = fasterize['deferJsNs'];

/**
 * @constructor
 */
deferJsNs.DeferJs = function() {
  /**
   * Queue of tasks that need to be executed in order.
   * @type {!Array.<function()>}
   * @private
   */
  this.queue_ = [];

  /**
   * Array of logs, for debugging.
   * @type {Array.<string>}
   */
  this.logs = [];

  /**
   * Next item in the queue to be executed.
   * @type {!number}
   * @private
   */
  this.next_ = 0;

  /**
   * Number of scripts dynamically inserted which are not yet executed.
   * @type {!number}
   * @private
   */
  this.dynamicInsertedScriptCount_ = 0;

  /**
   * Scripts dynamically inserted by other scripts.
   * @type {Array.<Element>}
   * @private
   */
  this.dynamicInsertedScript_ = [];

  /**
   * document.write() strings get buffered here, they get rendered when the
   * current script is finished executing.
   * @private
   */
  this.documentWriteHtml_ = '';

  // TODO(sriharis):  Can we have a listener module that is used for the
  // following.

  /**
   * Map of events to event listeners.
   * @type {!Object}
   * @private
   */
  this.eventListenersMap_ = {};

  /**
   * Valid Mime types for Javascript.
   */
  this.jsMimeTypes =
      ['application/ecmascript',
       'application/javascript',
       'application/x-ecmascript',
       'application/x-javascript',
       'text/ecmascript',
       'text/javascript',
       'text/javascript1.0',
       'text/javascript1.1',
       'text/javascript1.2',
       'text/javascript1.3',
       'text/javascript1.4',
       'text/javascript1.5',
       'text/jscript',
       'text/livescript',
       'text/x-ecmascript',
       'text/x-javascript'];

  /**
   * We override certain builtin browser functions, such as document.write.
   * After OnLoad, however, these should go back to behaving as they originally
   * did.  This flag deals with the case where client JS code in turn overrides
   * our overridden implementations.
   * @type boolean
   * @private
   */
  this.overrideDefaultImplementation_ = true;

  /**
   * Original document.getElementById handler.
   * @private
   */
  this.origGetElementById_ = document.getElementById;

  /**
   * Original document.getElementsByTagName handler.
   * @private
   */
  this.origGetElementsByTagName_ = document.getElementsByTagName;

  /**
   * Original document.write handler.
   * @private
   */
  this.origDocWrite_ = document.write;

  /**
   * Original document.writeln handler.
   * @private
   */
  this.origDocWriteln_ = document.writeln;

  /**
   * Original document.open handler.
   * @private
   */
  this.origDocOpen_ = document.open;

  /**
   * Original document.close handler.
   * @private
   */
  this.origDocClose_ = document.close;

  /**
   * Original document.addEventListener handler.
   * @private
   */
  this.origDocAddEventListener_ = document.addEventListener;

  /**
   * Original window.addEventListener handler.
   * @private
   */
  this.origWindowAddEventListener_ = window.addEventListener;

  /**
   * Original document.addEventListener handler.
   * @private
   */
  this.origDocAttachEvent_ = document.attachEvent;

  /**
   * Original window.addEventListener handler.
   * @private
   */
  this.origWindowAttachEvent_ = window.attachEvent;

  /**
   * Original document.createElement handler.
   * @private
   */
  this.origCreateElement_ = document.createElement;

  /**
   * Maintains the current state for the deferJs.
   * @type {!number}
   * @private
   */
  this.state_ = deferJsNs.DeferJs.STATES.NOT_STARTED;

  /**
   * Maintains the last fired event.
   * @type {!number}
   * @private
   */
  this.eventState_ = deferJsNs.DeferJs.EVENT.NOT_STARTED;

  /**
   * Callback to call when current incremental scripts are done executing.
   * @private
   */
  this.incrementalScriptsDoneCallback_ = null;

  /**
   * This variable counts the total number of async scripts created by no defer
   * scripts.
   * @type {!number}
   * @private
   */
  this.noDeferAsyncScriptsCount_ = 0;

  /**
   * Async scripts created by no defer scripts.
   * @type {Array.<Element>}
   * @private
   */
  this.noDeferAsyncScripts_ = [];

  /**
   * Type of the javascript node that will get executed.
   * @type {string}
   * @private
   */
  this.psaScriptType_ = '';

  /**
   * Attribute added for nodes which are not processed yet.
   * @type {string}
   * @private
   */
  this.psaNotProcessed_ = '';

  /**
   * Last Index until incremental scripts will be executed, rest scripts will
   * be executed after the execution of incrementalScriptsDoneCallback_.
   * @type {!number}
   * @private
   */
  this.optLastIndex_ = -1;
};

/**
 * State Machine
 * NOT_STARTED --> SCRIPTS_REGISTERED --> SCRIPTS_EXECUTING ----------
 *                                                                    |
 *                                                                    |
 * SCRIPTS_DONE <--- WAITING_FOR_ONLOAD <--- SYNC_SCRIPTS_DONE <------
 *
 * Constants for different states of deferJs exeuction.
 * @enum {number}
 */
deferJsNs.DeferJs.STATES = {
  /**
   * Start state.
   */
  NOT_STARTED: 0,
  /**
   * In this state all script tags with type as 'text/psajs' are registered for
   * deferred execution.
   */
  SCRIPTS_REGISTERED: 1,
  /**
   * Script execution is in process.
   */
  SCRIPTS_EXECUTING: 2,
  /**
   * All the sync scripts are executed but some async scripts may not executed
   * till now.
   */
  SYNC_SCRIPTS_DONE: 3,
  /**
   * Waiting for onload event to be triggered.
   */
  WAITING_FOR_ONLOAD: 4,
  /**
   * Final state.
   */
  SCRIPTS_DONE: 5
};

/**
 * Constants for different events used by deferJs.
 * @enum {number}
 */
deferJsNs.DeferJs.EVENT = {
  /**
   * Start event state.
   */
  NOT_STARTED: 0,
  /**
   * Event triggered before executing deferred scripts.
   */
  BEFORE_SCRIPTS: 1,
  /**
   * Event corresponding to DOMContentLoaded.
   */
  DOM_READY: 2,
  /**
   * Event corresponding to onload.
   */
  LOAD: 3,
  /**
   * Event triggered after executing deferred scripts.
   */
  AFTER_SCRIPTS: 4
};

/**
 * Name of the attribute set for the nodes that are not reached so far during
 * scripts execution.
 * @const {string}
 */
deferJsNs.DeferJs.PSA_NOT_PROCESSED = 'frz_not_processed';

/**
 * Name of the attribute set for the current node to mark the current location.
 * @const {string}
 */
deferJsNs.DeferJs.PSA_CURRENT_NODE = 'frz_current_node';

/**
 * Value for psa dummy script nodes.
 * @const {string}
 */
deferJsNs.DeferJs.PSA_SCRIPT_TYPE = 'text/frzjs';

/**
 * Name of orig_type attribute in deferred script node.
 * @const {string}
 */
deferJsNs.DeferJs.PSA_ORIG_TYPE = 'frz_orig_type';

/**
 * Name of orig_src attribute in deferred script node.
 * @const {string}
 */
deferJsNs.DeferJs.PSA_ORIG_SRC = 'frz_orig_src';

/**
 * Name of orig_index attribute in deferred script node.
 * @const {string}
 */
deferJsNs.DeferJs.PSA_ORIG_INDEX = 'orig_index';

/**
 * Name of the deferred onload attribute.
 * @const {string}
 */
deferJsNs.DeferJs.PAGESPEED_ONLOAD = 'data-frz-onload';

/**
 * Add to defer_logs if logs are enabled.
 * @param {string} line line to be added to log.
 * @param {Error} opt_exception optional exception to pass to log.
 */
deferJsNs.DeferJs.prototype.log = function(line, opt_exception) {
  if (this.logs) {
    this.logs.push('' + line);
    if (opt_exception) {
      this.logs.push(opt_exception);
      if (typeof(console) != 'undefined' &&
          typeof(console.error) != 'undefined') {
        console.error(line, opt_exception.stack);
      }
    }
  }
};

/**
 * Adds task to the end of queue, unless position is explicitly given.
 * @param {!function()} task Function closure to be executed later.
 * @param {number} opt_pos optional position for ordering of jobs.
 */
deferJsNs.DeferJs.prototype.submitTask = function(task, opt_pos) {
  var pos = opt_pos ? opt_pos : this.queue_.length;
  this.queue_.splice(pos, 0, task);
};

/**
 * @param {string} str to be evaluated.
 * @param {Element} opt_script_elem Script element to copy attributes into the
 *     new script node.
 * @return {Element} Script cloned element which is created.
 */
deferJsNs.DeferJs.prototype.globalEval = function(str, opt_script_elem) {
  var script = this.cloneScriptNode(opt_script_elem);
  script.text = str;
  script.setAttribute('type', 'text/javascript');
  var currentElem = this.getCurrentDomLocation();
  currentElem.parentNode.insertBefore(script, currentElem);
  return script;
};

/**
 * Defines a new var in the name of id's present in the doc. This is the fix for
 * IE, where setting value to the var with same name as an id in the doc throws
 * exception. While creating vars, skip the names which have '-', ':', '.'.
 * Also, variable names cannot start with digits.
 * These characters are allowed in id names but not allowed in variable
 * names.
 */
deferJsNs.DeferJs.prototype.createIdVars = function() {
  var elems = document.getElementsByTagName('*');
  var idVarsString = '';
  for (var i = 0; i < elems.length; i++) {
    // Don't use elem.id since it leads to problem in forms.
    if (elems[i].hasAttribute('id')) {
      var idStr = elems[i].getAttribute('id');
      if (idStr && idStr.search(/[-:.]/) == -1 &&
          idStr.search(/^[0-9]/) == -1) {
        try {
          if (window[idStr] && window[idStr].tagName) {
            idVarsString += 'var ' + idStr +
                '=document.getElementById("' + idStr + '");';
          }
        } catch (err) {
          this.log('Exception while evaluating the script : ', err);
        }
      }
    }
  }
  if (idVarsString) {
    var script = this.globalEval(idVarsString);
    script.setAttribute(deferJsNs.DeferJs.PSA_NOT_PROCESSED, '');
  }
};

/**
 * Defers execution of scriptNode, by adding it to the queue.
 * @param {Element} script script node.
 * @param {number} opt_pos Optional position for ordering.
 * @param {boolean} opt_prefetch Script file is prefetched if true.
 */
deferJsNs.DeferJs.prototype.addNode = function(script, opt_pos) {
  var src = script.getAttribute(deferJsNs.DeferJs.PSA_ORIG_SRC) ||
      script.getAttribute('src');
  if (src) {
    this.addUrl(src, script, opt_pos);
  } else {
    // ||'ed with empty string to make sure the the value of str is not
    // undefined or null.
    var str = script.innerHTML || script.textContent || script.data || '';
    this.addStr(str, script, opt_pos);
  }
};

/**
 * Defers execution of 'str', by adding it to the queue.
 * @param {!string} str valid javascript snippet.
 * @param {Element} script_elem Psa inserted script used as context element.
 * @param {number} opt_pos Optional position for ordering.
 */
deferJsNs.DeferJs.prototype.addStr = function(str, script_elem, opt_pos) {
  if (this.isFireFox()) {
    // This is due to some bug identified in firefox.
    // Got this workaround from the bug raised on firefox.
    // https://bugzilla.mozilla.org/show_bug.cgi?id=728151
    this.addUrl('data:text/javascript,' + encodeURIComponent(str),
                script_elem,
                opt_pos);
    return;
  }
  this.logs.push('Add to queue str: ' + str);
  var me = this; // capture closure.
  this.submitTask(function() {
    me.removeNotProcessedAttributeTillNode(script_elem);

    var node = me.nextPsaJsNode();
    node.setAttribute(deferJsNs.DeferJs.PSA_CURRENT_NODE, '');
    try {
      me.globalEval(str, script_elem);
    } catch (err) {
      me.log('Exception while evaluating the script : ', err);
    }
    me.log('Evaluated: ' + str);
    // TODO(ksimbili): Detach stack here to prevent recursion issues.
    me.runNext();
  }, opt_pos);
};
deferJsNs.DeferJs.prototype['addStr'] = deferJsNs.DeferJs.prototype.addStr;

/**
 * Clones a Script Node. This is equivalent of 'cloneNode'.
 * @param {Element} opt_script_elem Psa inserted script used for cloning the
 *     new element.
 * @return {Element} Script Element with all attributes copied from
 *     opt_script_elem.
 */
deferJsNs.DeferJs.prototype.cloneScriptNode = function(opt_script_elem) {
  var newScript = this.origCreateElement_.call(document, 'script');
  if (opt_script_elem) {
    // Copy attributes.
    for (var a = opt_script_elem.attributes, n = a.length, i = n - 1;
         i >= 0; --i) {
      // Ignore 'type' and 'src' as they are set later.
      // Ignore 'async' and 'defer', as our current.
      // TODO(ksimbili): If a script has async then don't wait for it to load.
      if (a[i].name != 'type' && a[i].name != 'src' &&
          a[i].name != 'async' && a[i].name != 'defer' &&
          a[i].name != deferJsNs.DeferJs.PSA_ORIG_TYPE &&
          a[i].name != deferJsNs.DeferJs.PSA_ORIG_SRC &&
          a[i].name != deferJsNs.DeferJs.PSA_ORIG_INDEX &&
          a[i].name != deferJsNs.DeferJs.PSA_CURRENT_NODE &&
          a[i].name != this.psaNotProcessed_) {
        newScript.setAttribute(a[i].name, a[i].value);
        opt_script_elem.removeAttribute(a[i].name);
      }
    }
  }
  return newScript;
};

/**
 * Defers execution of contents of 'url'.
 * @param {!string} url returns javascript when fetched.
 * @param {Element} script_elem Psa inserted script used as context element.
 * @param {number} opt_pos Optional position for ordering.
 */
deferJsNs.DeferJs.prototype.addUrl = function(url, script_elem, opt_pos) {
  this.logs.push('Add to queue url: ' + url);
  var me = this; // capture closure.
  this.submitTask(function() {
    me.removeNotProcessedAttributeTillNode(script_elem);

    var script = me.cloneScriptNode(script_elem);
    script.setAttribute('type', 'text/javascript');
    var useSyncScript = true;
    if ('async' in script) {
      script.async = false;
    } else if (script.readyState) {
      useSyncScript = false;
      var stateChangeHandler = function() {
        if (script.readyState == 'complete' ||
            script.readyState == 'loaded') {
          script.onreadystatechange = null;
          me.log('Executed: ' + url);
          me.runNext();
        }
      };
      fasterizeutils.addHandler(script, 'readystatechange', stateChangeHandler);
    }
    script.setAttribute('src', url);
    // If a script node with src also has a node inside it
    // (as innerHTML etc.), we simply create an equivalent text node so
    // that the DOM remains the same. Note that we do not try to execute
    // the contents of this node.
    var str = script_elem.innerHTML ||
        script_elem.textContent ||
        script_elem.data;
    if (str) {
      script.appendChild(document.createTextNode(str));
    }
    if (useSyncScript) {
      var runNextHandler = function() {
        me.log('Executed: ' + url);
        me.runNext();
      };
      fasterizeutils.addHandler(script, 'load', runNextHandler);
      fasterizeutils.addHandler(script, 'error', runNextHandler);
    }
    var currentElem = me.nextPsaJsNode();
    currentElem.setAttribute(deferJsNs.DeferJs.PSA_CURRENT_NODE, '');
    currentElem.parentNode.insertBefore(script, currentElem);
  }, opt_pos);
};
deferJsNs.DeferJs.prototype['addUrl'] = deferJsNs.DeferJs.prototype.addUrl;

/**
 * Remove psaNotProcessed_ attribute till the given node.
 * @param {Node} opt_node Stop node.
 */
deferJsNs.DeferJs.prototype.removeNotProcessedAttributeTillNode = function(
    opt_node) {
  if (document.querySelectorAll && !(this.getIEVersion() <= 8)) {
    var nodes = document.querySelectorAll(
        '[' + this.psaNotProcessed_ + ']');
    for (var i = 0; i < nodes.length; i++) {
      var dom_node = nodes.item(i);
      if (dom_node == opt_node) {
        return;
      }
      if (dom_node.getAttribute('type') != this.psaScriptType_) {
        dom_node.removeAttribute(this.psaNotProcessed_);
      }
    }
  }
};

/**
 * Set 'psa_not_processed' attribute to all Nodes in DOM.
 */
deferJsNs.DeferJs.prototype.setNotProcessedAttributeForNodes = function() {
  var nodes = this.origGetElementsByTagName_.call(document, '*');
  for (var i = 0; i < nodes.length; i++) {
    var dom_node = nodes.item(i);
    dom_node.setAttribute(this.psaNotProcessed_, '');
  }
};

/**
 * Get the next script psajs node to be executed.
 * @return {Element} Element having type attribute set to 'text/psajs'.
 */
deferJsNs.DeferJs.prototype.nextPsaJsNode = function() {
  var current_node = null;
  if (document.querySelector) {
    current_node = document.querySelector(
        '[type="' + this.psaScriptType_ + '"]');
  }
  return current_node;
};

/**
 * Get the current location in DOM for the new nodes insertion. New nodes are
 * inserted before the returned node.
 * @return {Element} Element having 'psa_current_node' attribute.
 */
deferJsNs.DeferJs.prototype.getCurrentDomLocation = function() {
  var current_node;
  if (document.querySelector) {
    current_node = document.querySelector(
        '[' + deferJsNs.DeferJs.PSA_CURRENT_NODE + ']');
  }
  return current_node ||
      this.origGetElementsByTagName_.call(document, 'psanode')[0];
};

/**
 * Removes the processed script node with 'text/psajs'.
 */
deferJsNs.DeferJs.prototype.removeCurrentDomLocation = function() {
  var oldNode = this.getCurrentDomLocation();
  // getCurrentDomLocation can return 'psanode' which is not a script.
  if (oldNode.nodeName == 'SCRIPT') {
    oldNode.parentNode.removeChild(oldNode);
  }
};

/**
 * Called when the script Queue execution is finished.
 */
deferJsNs.DeferJs.prototype.onComplete = function() {
  if (this.state_ >= deferJsNs.DeferJs.STATES.WAITING_FOR_ONLOAD) {
    return;
  }

  // ReadyState should be restored only during the last onComplete,
  // so that document.readyState returns 'loading' till the last deferred
  // script is executed.
  if (this.getIEVersion() && document.documentElement['originalDoScroll']) {
    document.documentElement.doScroll =
        document.documentElement['originalDoScroll'];
  }
  if (Object.defineProperty) {
    // Delete document.readyState so that browser can restore it.
    delete document['readyState'];
  }
  if (this.getIEVersion()) {
    if (Object.defineProperty) {
      // Delete document.all so that browser can restore it.
      delete document['all'];
    }
  }

  this.overrideDefaultImplementation_ = false;

  this.state_ = deferJsNs.DeferJs.STATES.WAITING_FOR_ONLOAD;

  var me = this;
  if (document.readyState != 'complete') {
    deferJsNs.addOnload(window, function() {
      me.fireOnload();
    });
  } else {
    // Here there is a chance that window.onload is triggered twice.
    // But we have no way of finding this.
    // TODO(ksimbili): Fix the above scenario.
    if (document.onreadystatechange) {
      this.exec(document.onreadystatechange, document);
    }
    // Execute window.onload
    if (window.onload) {
      psaAddEventListener(window, 'onload', window.onload);
      window.onload = null;
    }
    this.fireOnload();
  }
};

/**
 * Fires 'onload' event.
 */
deferJsNs.DeferJs.prototype.fireOnload = function() {
  // Add all the elements whose onloads are deferred.
  // Note, by the time we come here, all the images, iframes etc all should have
  // been loaded. Because main page onload gets triggered when all it's
  // resources are loaded.So we can blindly trigger all those onloads.
  this.addDeferredOnloadListeners();

  this.fireEvent(deferJsNs.DeferJs.EVENT.LOAD);

  // Clean up psanode elements from the DOM.
  var psanodes = document.body.getElementsByTagName('psanode');
  for (var i = (psanodes.length - 1); i >= 0; i--) {
    document.body.removeChild(psanodes[i]);
  }

  this.state_ = deferJsNs.DeferJs.STATES.SCRIPTS_DONE;
  this.fireEvent(deferJsNs.DeferJs.EVENT.AFTER_SCRIPTS);
};

/**
 * Checks if node is present in the dom.
 * @param {Node} node Node whose presence in the dom is checked.
 * @return {boolean} returns true if node is present in the Node, false
 * otherwise.
 */
deferJsNs.DeferJs.prototype.checkNodeInDom = function(node) {
  while (node = node.parentNode) {
    if (node == document) {
      return true;
    }
  }
  return false;
};

/**
 * Script onload is not triggered if src is empty because such scripts
 * are not async scripts as these scripts will be executed while parsing
 * the dom.
 * @param {Array.<Element>} dynamicInsertedScriptList is the list of dynamic
 *     inserted scripts.
 * @return {number} returns the number of scripts whose onload will not get
 *     triggered.
 */
deferJsNs.DeferJs.prototype.getNumScriptsWithNoOnload =
    function(dynamicInsertedScriptList) {
  var count = 0;
  var len = dynamicInsertedScriptList.length;
  for (var i = 0; i < len; ++i) {
    var node = dynamicInsertedScriptList[i];
    var parent = node.parentNode;
    var src = node.src;
    var text = node.textContent;
    // IE behaves differently for async scripts compared to other browsers.
    // IE triggeres script onload only if parent is not null and src or
    // textContent is not empty. But other browsers trigger onload only if
    // node is present in the dom and src is not empty.
    if (((this.getIEVersion() > 8) &&
            (!parent || (src == '' && text == ''))) ||
        (!this.getIEVersion() &&
                (!this.checkNodeInDom(node) || src == ''))) {
      count++;
    }
  }
  return count;
};

/**
 *  Checks if onComplete() function can be called or not.
 *  @return {boolean} returns true if onComplete() can be called.
 */
deferJsNs.DeferJs.prototype.canCallOnComplete = function() {
  // TODO(pulkitg): Handle scenario where somebody sets innetHTML and references
  // in the this.dynamicInsertedScriptCount_ become invalid.
  if (this.state_ != deferJsNs.DeferJs.STATES.SYNC_SCRIPTS_DONE) {
    return false;
  }
  var count = 0;
  if (this.dynamicInsertedScriptCount_ != 0) {
    count = this.getNumScriptsWithNoOnload(this.dynamicInsertedScript_);
  }
  if (this.dynamicInsertedScriptCount_ == count) {
    return true;
  }
  return false;
};

/**
 * Whether all the deferred scripts are done executing.
 * @return {boolean} true if all deferred scripts are done executing, false
 * otherwise.
 */
deferJsNs.DeferJs.prototype.scriptsAreDone = function() {
  return this.state_ === deferJsNs.DeferJs.STATES.SCRIPTS_DONE;
};
deferJsNs.DeferJs.prototype['scriptsAreDone'] =
    deferJsNs.DeferJs.prototype.scriptsAreDone;

/**
 * Schedules the next task in the queue.
 */
deferJsNs.DeferJs.prototype.runNext = function() {
  this.handlePendingDocumentWrites();
  this.removeCurrentDomLocation();
  if (this.next_ < this.queue_.length) {
    // Done here to prevent another _run_next() in stack from
    // seeing the same value of next, and get into infinite
    // loop.
    this.next_++;
    this.queue_[this.next_ - 1].call(window);
  } else {
    this.state_ = deferJsNs.DeferJs.STATES.SYNC_SCRIPTS_DONE;
    this.removeNotProcessedAttributeTillNode();
    this.fireEvent(deferJsNs.DeferJs.EVENT.DOM_READY);
    if (this.canCallOnComplete()) {
      this.onComplete();
    }
  }
};

/**
 * Converts from NodeList to array of nodes.
 * @param {!NodeList} nodeList NodeList from a DOM node.
 * @return {!Array.<Node>} Array of nodes returned.
 */
deferJsNs.DeferJs.prototype.nodeListToArray = function(nodeList) {
  var arr = [];
  var len = nodeList.length;
  for (var i = 0; i < len; ++i) {
    arr.push(nodeList.item(i));
  }
  return arr;
};

/**
 * SetUp needed before deferred scripts execution.
 */
deferJsNs.DeferJs.prototype.setUp = function() {
  var me = this;

  // TODO(ksimbili): Remove this once context is not optional.
  // Place where document.write() happens if there is no context element
  // present. Happens if there is no context registering that happened in
  // registerNoScriptTags.
  var initialContextNode = document.createElement('psanode');
  initialContextNode.setAttribute('psa_dw_target', 'true');
  document.body.appendChild(initialContextNode);
  if (this.getIEVersion()) {
    this.createIdVars();
  }

  if (Object.defineProperty) {
    try {
      // Shadow document.readyState
      var propertyDescriptor = { configurable: true };
      propertyDescriptor.get = function() {
        return (me.state_ >= deferJsNs.DeferJs.STATES.SYNC_SCRIPTS_DONE) ?
            'interactive' : 'loading';
      };
      Object.defineProperty(document, 'readyState', propertyDescriptor);
    } catch (err) {
      this.log('Exception while overriding document.readyState.', err);
    }
  }
  if (this.getIEVersion()) {
    // In IE another approach for identifying DOMContentLoaded is popularly
    // used. It is described in http://javascript.nwbox.com/IEContentLoaded/ .
    // And JQuery is one of the libraries which employs this strategy.
    document.documentElement['originalDoScroll'] =
        document.documentElement.doScroll;
    document.documentElement.doScroll = function() {
      throw ('psa exception');
    };
    if (Object.defineProperty) {
      try {
        // Shadow document.all
        var propertyDescriptor = { configurable: true };
        propertyDescriptor.get = function() { return undefined; };
        Object.defineProperty(document, 'all', propertyDescriptor);
      } catch (err) {
        this.log('Exception while overriding document.all.', err);
      }
    }
  }

  // override AddEventListeners.
  this.overrideAddEventListeners();

  // TODO(ksimbili): Restore the following functions to their original.
  document.writeln = function(x) {
    me.writeHtml(x + '\n');
  };
  document.write = function(x) {
    me.writeHtml(x);
  };
  document.open = function() {
    if (!me.overrideDefaultImplementation_) {
      me.origDocOpen_.call(document);
    }
  };
  document.close = function() {
    if (!me.overrideDefaultImplementation_) {
      me.origDocClose_.call(document);
    }
  };

  document.getElementById = function(str) {
    me.handlePendingDocumentWrites();
    var node = me.origGetElementById_.call(document, str);
    return (node == null ||
            node.hasAttribute(me.psaNotProcessed_)) ? null : node;
  };

  if (document.querySelectorAll && !(me.getIEVersion() <= 8)) {
    // TODO(ksimbili): Support IE8
    // TODO(jmaessen): More to the point, this only sort of works even on modern
    // browsers; origGetElementsByTagName returns a live list that changes to
    // reflect DOM changes and querySelectorAll does not (and is known to be
    // massively slower on many browsers as a result).  We might be able to get
    // around this using delegates a la document.readyState, but it'll be hard.
    document.getElementsByTagName = function(tagName) {
      if (me.overrideDefaultImplementation_) {
        try {
          return document.querySelectorAll(
              tagName + ':not([' + me.psaNotProcessed_ + '])');
        } catch (err) {
          // Fall through and emulate original behavior
        }
      }
      return me.origGetElementsByTagName_.call(document, tagName);
    };
  }

  // Overriding createElement().
  // Attaching onload & onerror function if script node is created.
  document.createElement = function(str) {
    var elem = me.origCreateElement_.call(document, str);
    if (me.overrideDefaultImplementation_ &&
        str.toLowerCase() == 'script') {
      me.dynamicInsertedScript_.push(elem);
      me.dynamicInsertedScriptCount_++;
      var onload = function() {
        me.dynamicInsertedScriptCount_--;
        var index = me.dynamicInsertedScript_.indexOf(this);
        if (index != -1) {
          me.dynamicInsertedScript_.splice(index, 1);
          if (me.canCallOnComplete()) {
            me.onComplete();
          }
        }
      };
      deferJsNs.addOnload(elem, onload);
      fasterizeutils.addHandler(elem, 'error', onload);
    }
    return elem;
  };
};

/**
 * Start the execution of the deferred script only if there is no async script
 * pending that was created by non deferred.
 */
deferJsNs.DeferJs.prototype.execute = function() {
  if (this.state_ != deferJsNs.DeferJs.STATES.SCRIPTS_REGISTERED) {
    return;
  }
  var count = 0;
  if (this.noDeferAsyncScriptsCount_ != 0) {
    count = this.getNumScriptsWithNoOnload(this.noDeferAsyncScripts_);
  }
  if (this.noDeferAsyncScriptsCount_ == count) {
    this.run();
  }
};
deferJsNs.DeferJs.prototype['execute'] = deferJsNs.DeferJs.prototype.execute;

/**
 * Starts the execution of all the deferred scripts.
 */
deferJsNs.DeferJs.prototype.run = function() {
  if (this.state_ != deferJsNs.DeferJs.STATES.SCRIPTS_REGISTERED) {
    return;
  }

  this.fireEvent(deferJsNs.DeferJs.EVENT.BEFORE_SCRIPTS);
  this.state_ = deferJsNs.DeferJs.STATES.SCRIPTS_EXECUTING;
  this.setUp();
  // Starts executing the defer_js closures.
  this.runNext();
};
deferJsNs.DeferJs.prototype['run'] = deferJsNs.DeferJs.prototype.run;

/**
 * Parses the given html snippet.
 * @param {!string} html to be parsed.
 * @return {!Node} returns a DIV containing parsed nodes as children.
 */
deferJsNs.DeferJs.prototype.parseHtml = function(html) {
  var div = this.origCreateElement_.call(document, 'div');
  // IE HACK -- Two options.
  // 1) Either add a dummy character at the start and delete it after parsing.
  // 2) Add some non-empty node infront of html.
  div.innerHTML = '<div>_</div>' + html;
  div.removeChild(div.firstChild);
  return div;
};

/**
 * Removes the node from its parent if it has one.
 * @param {Node} node Node to be disowned from parent.
 */
deferJsNs.DeferJs.prototype.disown = function(node) {
  var parentNode = node.parentNode;
  if (parentNode) {
    parentNode.removeChild(node);
  }
};

/**
 * Inserts all the nodes before elem. It must have a parentNode for this
 * operation to succeed. (either actually inserted in DOM)
 * @param {!NodeList} nodes to insert.
 * @param {!Node} elem context element.
 */
deferJsNs.DeferJs.prototype.insertNodesBeforeElem = function(nodes, elem) {
  var nodeArray = this.nodeListToArray(nodes);
  var len = nodeArray.length;
  var parentNode = elem.parentNode;
  for (var i = 0; i < len; ++i) {
    var node = nodeArray[i];
    this.disown(node);
    parentNode.insertBefore(node, elem);
  }
};

/**
 * Returns if the node is JavaScript Node.
 * @param {!Node} node valid script Node.
 * @return {boolean} true if script node is javascript node.
 */
deferJsNs.DeferJs.prototype.isJSNode = function(node) {
  if (node.nodeName != 'SCRIPT') {
    return false;
  }

  if (node.hasAttribute('type')) {
      var type = node.getAttribute('type');
      return !type ||
             (this.jsMimeTypes.indexOf(type) != -1);
  } else if (node.hasAttribute('language')) {
      var lang = node.getAttribute('language');
      return !lang ||
             (this.jsMimeTypes.indexOf('text/' + lang.toLowerCase()) != -1);
  }
  return true;
};

/**
 * Given the list of nodes, sets the not_processed attributes to all nodes and
 * generates list of script nodes.
 * @param {!Node} node starting node for DFS.
 * @param {!Array.<Element>} scriptNodes array of script elements (output).
 */
deferJsNs.DeferJs.prototype.markNodesAndExtractScriptNodes = function(
    node, scriptNodes) {
  if (!node.childNodes) {
    return;
  }
  var nodeArray = this.nodeListToArray(node.childNodes);
  var len = nodeArray.length;
  for (var i = 0; i < len; ++i) {
    var child = nodeArray[i];
    // <script id='A'>
    //  command1
    //  document.write('<script id='B'>command2<script>');
    //  command3
    // <\/script>
    // Browser behaviour for above script node is as follows- first execute
    // command1 and after the execution of command1, scriptB starts executing
    // and only after the complete execution of script B, command3 will execute.
    // But with deferJs turned on, after the execution of command 1, command3
    // gets executed and only after the complete execution of script A, script B
    // will execute.
    // TODO(pulkitg): Make both behaviour consistent.
    if (child.nodeName == 'SCRIPT') {
      if (this.isJSNode(child)) {
        scriptNodes.push(child);
        child.setAttribute(deferJsNs.DeferJs.PSA_ORIG_TYPE, child.type);
        child.setAttribute('type', this.psaScriptType_);
        child.setAttribute(deferJsNs.DeferJs.PSA_ORIG_SRC, child.src);
        child.setAttribute('src', '');
        child.setAttribute(this.psaNotProcessed_, '');
      }
    } else {
      this.markNodesAndExtractScriptNodes(child, scriptNodes);
    }
  }
};

/**
 * @param {!Array.<Element>} scripts Array of script nodes to be deferred.
 * @param {!number} pos position for script ordering.
 */
deferJsNs.DeferJs.prototype.deferScripts = function(scripts, pos) {
  var len = scripts.length;
  for (var i = 0; i < len; ++i) {
    this.addNode(scripts[i], pos + i);
  }
};

/**
 * Inserts html in the before elem, with scripts inside added to queue at pos.
 * @param {!string} html contains the snippet.
 * @param {!number} pos optional position to add to queue.
 * @param {Element} opt_elem optional context element.
 */
deferJsNs.DeferJs.prototype.insertHtml = function(html, pos, opt_elem) {
  // Parse the html.
  var node = this.parseHtml(html);

  // Extract script nodes out for deferring them.
  var scriptNodes = [];
  this.markNodesAndExtractScriptNodes(node, scriptNodes);

  // Add non-script nodes before elem
  if (opt_elem) {
    this.insertNodesBeforeElem(node.childNodes, opt_elem);
  } else {
    this.log('Unable to insert nodes, no context element found');
  }

  // Add script nodes for deferring.
  this.deferScripts(scriptNodes, pos);
};

/**
 * Renders the document.write() buffer before the context
 * element.
 */
deferJsNs.DeferJs.prototype.handlePendingDocumentWrites = function() {
  if (this.documentWriteHtml_ == '') {
    return;
  }
  this.log('handle_dw: ' + this.documentWriteHtml_);

  var html = this.documentWriteHtml_;
  // Reset early because insertHtml may internally end up calling this function
  // recursively.
  this.documentWriteHtml_ = '';

  var currentElem = this.getCurrentDomLocation();
  this.insertHtml(html, this.next_, currentElem);
};

/**
 * Writes html like document.write to the current context item.
 * @param {string} html Html to be written before current context elem.
 */
deferJsNs.DeferJs.prototype.writeHtml = function(html) {
  if (this.overrideDefaultImplementation_) {
    this.log('dw: ' + html);
    this.documentWriteHtml_ += html;
  } else {
    this.origDocWrite_.call(document, html);
  }
};

/**
 * Adds page onload event listeners to our own list and called them later.
 */
deferJsNs.DeferJs.prototype.addDeferredOnloadListeners = function() {
  var onloadDeferredElements;
  if (document.querySelectorAll) {
    onloadDeferredElements = document.querySelectorAll(
        '[' + deferJsNs.DeferJs.PAGESPEED_ONLOAD + '][data-frz-loaded]');
  }
  for (var i = 0; i < onloadDeferredElements.length; i++) {
    var elem = onloadDeferredElements.item(i);
    var handlerStr = elem.getAttribute(deferJsNs.DeferJs.PAGESPEED_ONLOAD);
    var functionStr = 'var psaFunc=function() {' + handlerStr + '};';
    // Define a function with the string above.
    window['eval'].call(window, functionStr);
    if (typeof window['psaFunc'] != 'function') {
      this.log('Function is not defined', new Error(''));
      continue;
    }

    psaAddEventListener(elem, 'onload', window['psaFunc']);
  }
};

/**
 * Adds functions that run as the first thing in run().
 * @param {!function()} func onload listener.
 */
deferJsNs.DeferJs.prototype.addBeforeDeferRunFunctions = function(func) {
  psaAddEventListener(window, 'onbeforescripts', func);
};
deferJsNs.DeferJs.prototype['addBeforeDeferRunFunctions'] =
    deferJsNs.DeferJs.prototype.addBeforeDeferRunFunctions;

/**
 * Adds functions that run after all the deferred scripts, DOM ready listeners
 * and onload listeners have run.
 * @param {!function()} func onload listener.
 */
deferJsNs.DeferJs.prototype.addAfterDeferRunFunctions = function(func) {
  psaAddEventListener(window, 'onafterscripts', func);
};
deferJsNs.DeferJs.prototype['addAfterDeferRunFunctions'] =
    deferJsNs.DeferJs.prototype.addAfterDeferRunFunctions;

/**
 * Firing event will execute all listeners registered for the event.
 * @param {!deferJsNs.DeferJs.EVENT.<number>} evt Event to be fired.
 */
deferJsNs.DeferJs.prototype.fireEvent = function(evt) {
  this.eventState_ = evt;
  this.log('Firing Event: ' + evt);
  var eventListeners = this.eventListenersMap_[evt] || [];
  for (var i = 0; i < eventListeners.length; ++i) {
    this.exec(eventListeners[i]);
  }
  eventListeners.length = 0;
};

/**
 * Execute function under try catch.
 * @param {!function()} func Function to be executed.
 * @param {Window|Element|Document} opt_scopeObject Element to be used as scope.
 */
deferJsNs.DeferJs.prototype.exec = function(func, opt_scopeObject) {
  try {
    func.call(opt_scopeObject || window);
  } catch (err) {
    this.log('Exception while evaluating the script : ', err);
  }
};

/**
 * Override native event registration function on window and document objects.
 */
deferJsNs.DeferJs.prototype.overrideAddEventListeners = function() {
  var me = this;
  // override AddEventListeners.
  if (window.addEventListener) {
    document.addEventListener = function(eventName, func, capture) {
      psaAddEventListener(document, eventName, func,
                          me.origDocAddEventListener_, capture);
    };
    window.addEventListener = function(eventName, func, capture) {
      psaAddEventListener(window, eventName, func,
                          me.origWindowAddEventListener_, capture);
    };
  } else if (window.attachEvent) {
    document.attachEvent = function(eventName, func) {
      psaAddEventListener(document, eventName, func,
                          me.origDocAttachEvent_);
    };
    window.attachEvent = function(eventName, func) {
      psaAddEventListener(window, eventName, func,
                          me.origWindowAttachEvent_);
    };
  }
};

/**
 * Registers an event with the element.
 * @param {!(Window|Node|Document)} elem Element which is registering for the
 * event.
 * @param {!string} eventName Name of the event.
 * @param {(Function|EventListener|function())} func Event handler.
 * @param {Function} opt_originalAddEventListener Original Add event Listener
 * function.
 * @param {boolean} opt_capture Capture event.
 */
var psaAddEventListener = function(elem, eventName, func,
                                   opt_originalAddEventListener, opt_capture) {
  var deferJs = fasterize['deferJs'];
  if (deferJs.state_ >= deferJsNs.DeferJs.STATES.WAITING_FOR_ONLOAD) {
    // At this point we ought to revert to the original event listener
    // behavior.
    if (opt_originalAddEventListener) {
      opt_originalAddEventListener.call(elem, eventName, func, opt_capture);
      return;
    }
    // Unless there wasn't an event listener provided, in which case we are
    // calling psaAddEventListener internally and should check whether we have
    // work to do and fall through if so.  (Note that if we return
    // unconditionally here we miss event registrations and break pages.)
    if (deferJs.state_ >= deferJsNs.DeferJs.STATES.SCRIPTS_DONE) {
      return;
    }
  }
  var deferJsEvent;
  var deferJsEventName;

  if (deferJs.eventState_ < deferJsNs.DeferJs.EVENT.DOM_READY &&
     (eventName == 'DOMContentLoaded' || eventName == 'readystatechange' ||
      eventName == 'onDOMContentLoaded' || eventName == 'onreadystatechange')) {
    deferJsEvent = deferJsNs.DeferJs.EVENT.DOM_READY;
    deferJsEventName = 'DOMContentLoaded';
  } else if (deferJs.eventState_ < deferJsNs.DeferJs.EVENT.LOAD &&
            (eventName == 'load' || eventName == 'onload')) {
    deferJsEvent = deferJsNs.DeferJs.EVENT.LOAD;
    deferJsEventName = 'load';
  } else if (eventName == 'onbeforescripts') {
    deferJsEvent = deferJsNs.DeferJs.EVENT.BEFORE_SCRIPTS;
  } else if (eventName == 'onafterscripts') {
    deferJsEvent = deferJsNs.DeferJs.EVENT.AFTER_SCRIPTS;
  } else {
    if (opt_originalAddEventListener) {
      opt_originalAddEventListener.call(elem, eventName, func, opt_capture);
    }
    return;
  }
  var eventListenerClosure = function() {
    // HACK HACK: This is specifically to solve for jquery libraries, who try
    // to read the event being passed.
    // Note we are not setting any of the other params in event. We don't see
    // them as a need for now.
    // This is set based on documentation from
    // https://developer.mozilla.org/en-US/docs/DOM/Mozilla_event_reference/DOMContentLoaded#Cross-browser_fallback
    var customEvent = {};
    customEvent['bubbles'] = false;
    customEvent['cancelable'] = false;
    customEvent['eventPhase'] = 2;  // Event.AT_TARGET
    customEvent['timeStamp'] = new Date().getTime();
    customEvent['type'] = deferJsEventName;
    // event.target has to be some element in DOM. It can never be window.
    customEvent['target'] = (elem != window) ? elem : document;
    // This can be safely 'elem' because the two events "DOMContentLoaded' and
    // 'load' cannot bubble.
    customEvent['currentTarget'] = elem;
    func.call(elem, customEvent);
  };
  if (!deferJs.eventListenersMap_[deferJsEvent]) {
    deferJs.eventListenersMap_[deferJsEvent] = [];
  }
  deferJs.eventListenersMap_[deferJsEvent].push(
      eventListenerClosure);
};

/**
 * Registers all script tags which are marked text/psajs, by adding themselves
 * as the context element to the script embedded inside them.
 * @param {function()} opt_callback Called when critical scripts are
 *     done executing.
 * @param {number} opt_last_index till where its safe to run scripts.
 */
deferJsNs.DeferJs.prototype.registerScriptTags = function() {
  if (this.state_ >= deferJsNs.DeferJs.STATES.SCRIPTS_REGISTERED) {
    return;
  }

  this.state_ = deferJsNs.DeferJs.STATES.SCRIPTS_REGISTERED;
  var scripts = document.getElementsByTagName('script');
  var len = scripts.length;
  for (var i = 0; i < len; ++i) {
    var script = scripts[i];
    if (script.getAttribute('type') == this.psaScriptType_) {
      this.addNode(script);
    }
  }
};
deferJsNs.DeferJs.prototype['registerScriptTags'] =
    deferJsNs.DeferJs.prototype.registerScriptTags;

/**
 * Runs the function when element is loaded.
 * @param {Window|Element} elem Element to attach handler.
 * @param {!function()} func New onload handler.
 */
deferJsNs.addOnload = function(elem, func) {
  fasterizeutils.addHandler(elem, 'load', func);
};
fasterize['addOnload'] = deferJsNs.addOnload;

/**
 * @return {boolean} true if browser is Firefox.
 */
deferJsNs.DeferJs.prototype.isFireFox = function() {
  return (navigator.userAgent.indexOf('Firefox') != -1);
};

/**
 * @return {boolean} true if browser is WebKit based.
 */
deferJsNs.DeferJs.prototype.isWebKit = function() {
  return (navigator.userAgent.indexOf('AppleWebKit') != -1);
};

/**
 * @return {number} version number if browser is IE.
 */
deferJsNs.DeferJs.prototype.getIEVersion = function() {
  var version = /(?:MSIE.(\d+\.\d+))/.exec(navigator.userAgent);
  return (version && version[1]) ?
         (document.documentMode || parseFloat(version[1])) :
         NaN;
};

/**
 * Set the type of the scripts which will be executed.
 * @param {string} type of psa dummy nodes that need to be processed.
 */
deferJsNs.DeferJs.prototype.setType = function(type) {
  this.psaScriptType_ = type;
};

/**
 * Set the psaNotProcessed marker.
 * @param {string} psaNotProcessed marker.
 */
deferJsNs.DeferJs.prototype.setPsaNotProcessed = function(psaNotProcessed) {
  this.psaNotProcessed_ = psaNotProcessed;
};

/**
 * Overrides createElement for the non-deferred scripts. Any async script
 * created by non-deferred script should be executed before deferred scripts
 * gets executed.
 */
deferJsNs.DeferJs.prototype.noDeferCreateElementOverride = function() {
  // Attaching onload & onerror function if script node is created.
  var me = this;
  document.createElement = function(str) {
    var elem = me.origCreateElement_.call(document, str);
    if (me.overrideDefaultImplementation_ &&
        str.toLowerCase() == 'script') {
      me.noDeferAsyncScripts_.push(elem);
      me.noDeferAsyncScriptsCount_++;
      var onload = function() {
        var index = me.noDeferAsyncScripts_.indexOf(this);
        if (index != -1) {
          me.noDeferAsyncScripts_.splice(index, 1);
          me.noDeferAsyncScriptsCount_--;
          me.execute();
        }
      };
      deferJsNs.addOnload(elem, onload);
      fasterizeutils.addHandler(elem, 'error', onload);
    }
    return elem;
  };
};

/**
 * Initialize defer javascript.
 */
deferJsNs.deferInit = function() {
  if (fasterize['deferJs']) {
    return;
  }

  fasterize.deferJs = new deferJsNs.DeferJs();
  fasterize.deferJs.setType(deferJsNs.DeferJs.PSA_SCRIPT_TYPE);
  fasterize.deferJs.setPsaNotProcessed(
    deferJsNs.DeferJs.PSA_NOT_PROCESSED);
  fasterize.deferJs.setNotProcessedAttributeForNodes();

  fasterize.deferJs.noDeferCreateElementOverride();
  fasterize.deferJs.deferInsertScriptTag();
  fasterize['deferJs'] = fasterize.deferJs;
};

/**
 * Indicates if deferJs started executing.
 * @type {boolean}
 */
fasterize.deferJsStarted = false;

/**
 * Starts deferJs execution.
 */
deferJsNs.startDeferJs = function() {
  if (fasterize.deferJsStarted || fasterize['panelLoader']) return;
  if (window.preventDeferJSStart > 0) {
    window.preventDeferJSStart -= 1;
    setTimeout(function() {
      deferJsNs.startDeferJs();
    }, 50);
    return;
  }
  deferJsNs.deferInit();

  fasterize.deferJsStarted = true;
  fasterize.deferJs.registerScriptTags();
  fasterize.deferJs.execute();
};
deferJsNs['startDeferJs'] = deferJsNs.startDeferJs;
fasterizeutils.addHandler(document, 'DOMContentLoaded', deferJsNs.startDeferJs);
deferJsNs.addOnload(window, deferJsNs.startDeferJs);
