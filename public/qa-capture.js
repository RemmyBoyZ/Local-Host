(function () {
  var params = new URLSearchParams(window.location.search);
  var enabled = params.get('qaCapture') === '1';
  var testCaseId = params.get('qaTestCaseId') || params.get('caseId') || '';
  var sessionId = params.get('qaSessionId') || '';
  var relay = params.get('qaRelay') || 'http://127.0.0.1:3001';
  var maxTextLength = 4000;

  if (!enabled || !testCaseId || !sessionId || window.__qaManualCaptureInstalled) return;
  window.__qaManualCaptureInstalled = true;

  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  var originalXhrOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype.open;
  var originalXhrSend = window.XMLHttpRequest && window.XMLHttpRequest.prototype.send;
  var originalConsole = {};
  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    originalConsole[level] = console[level] ? console[level].bind(console) : function () {};
  });

  function truncate(value) {
    if (value == null) return value;
    var text = typeof value === 'string' ? value : safeStringify(value);
    if (text.length <= maxTextLength) return text;
    return text.slice(0, maxTextLength) + '... [truncated]';
  }

  function compactNetworkUrl(value) {
    var text = String(value || '');
    if (text.indexOf('data:') === 0) {
      var commaIndex = text.indexOf(',');
      var mediaType = text.slice(0, Math.min(commaIndex > 0 ? commaIndex : 80, 80));
      return (mediaType || 'data:') + ',[omitted ' + text.length + ' chars]';
    }
    if (text.indexOf('blob:') === 0) return 'blob:[omitted]';
    return truncate(text);
  }

  function shouldSkipNetworkBody(method, url) {
    var normalizedMethod = String(method || '').toUpperCase();
    var normalizedUrl = String(url || '');
    if (normalizedMethod === 'OPTIONS') return true;
    if (normalizedUrl.indexOf('data:') === 0 || normalizedUrl.indexOf('blob:') === 0) return true;
    return /\.(js|css|png|jpe?g|svg|gif|webp|ico|woff2?|ttf|map)([?#].*)?$/i.test(normalizedUrl)
      || /\/(assets|public|media|images)\//i.test(normalizedUrl);
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }

  function redactValue(key, value) {
    var sensitive = /authorization|cookie|token|password|secret|apikey|api-key|access_token|refresh_token/i;
    if (sensitive.test(String(key))) return '[REDACTED]';
    if (value && typeof value === 'object') return redactObject(value);
    return value;
  }

  function redactObject(input) {
    if (!input || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.slice(0, 20).map(function (item) { return redactObject(item); });
    var output = {};
    Object.keys(input).slice(0, 80).forEach(function (key) {
      output[key] = redactValue(key, input[key]);
    });
    return output;
  }

  function headersToObject(headers) {
    var output = {};
    if (!headers) return output;
    try {
      if (typeof Headers !== 'undefined' && headers instanceof Headers) {
        headers.forEach(function (value, key) {
          output[key] = redactValue(key, value);
        });
      } else if (Array.isArray(headers)) {
        headers.forEach(function (pair) {
          if (pair && pair.length >= 2) output[pair[0]] = redactValue(pair[0], pair[1]);
        });
      } else if (typeof headers === 'object') {
        Object.keys(headers).forEach(function (key) {
          output[key] = redactValue(key, headers[key]);
        });
      }
    } catch (_) {}
    return output;
  }

  function sendLog(payload) {
    var logPayload = Object.assign({
      type: 'log',
      source: 'manual-capture',
      testCaseId: testCaseId,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
    }, payload);

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(logPayload)], { type: 'application/json' });
        if (navigator.sendBeacon(relay.replace(/\/$/, '') + '/log', blob)) return;
      }
    } catch (_) {}

    try {
      if (originalFetch) {
        originalFetch(relay.replace(/\/$/, '') + '/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload),
          keepalive: true,
        }).catch(function () {});
      }
    } catch (_) {}
  }

  function cleanText(value, maxLength) {
    var text = String(value || '').replace(/\s+/g, ' ').trim();
    var limit = maxLength || 140;
    return text.length > limit ? text.slice(0, limit) + '...' : text;
  }

  function isSensitiveElement(element) {
    var type = String(element && element.type || '').toLowerCase();
    var name = String(element && (element.name || element.id || element.getAttribute && element.getAttribute('aria-label')) || '');
    return type === 'password' || /password|passwd|pwd|pin|token|secret|otp/i.test(name);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function getElementLabel(element) {
    if (!element || !element.getAttribute) return '';
    var aria = cleanText(element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || '', 120);
    if (aria) return aria;

    if (element.id) {
      var label = document.querySelector('label[for="' + cssEscape(element.id) + '"]');
      if (label) {
        var labelText = cleanText(label.innerText || label.textContent || '', 120);
        if (labelText) return labelText;
      }
    }

    var wrappedLabel = element.closest && element.closest('label');
    if (wrappedLabel) {
      var wrappedText = cleanText(wrappedLabel.innerText || wrappedLabel.textContent || '', 120);
      if (wrappedText) return wrappedText;
    }

    return cleanText(element.innerText || element.textContent || element.value || element.name || element.id || element.tagName || '', 120);
  }

  function getElementSelector(element) {
    if (!element || !element.tagName) return '';
    var parts = [];
    var current = element;
    while (current && current.nodeType === 1 && parts.length < 4) {
      var part = current.tagName.toLowerCase();
      if (current.id) {
        part += '#' + current.id;
        parts.unshift(part);
        break;
      }
      if (current.name) part += '[name="' + String(current.name).replace(/"/g, '\\"') + '"]';
      else if (current.getAttribute('data-testid')) part += '[data-testid="' + String(current.getAttribute('data-testid')).replace(/"/g, '\\"') + '"]';
      else if (current.className && typeof current.className === 'string') {
        var className = current.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (className) part += '.' + className;
      }
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  function getElementValue(element) {
    if (!element) return '';
    if (isSensitiveElement(element)) return '[REDACTED]';
    if (element.type === 'checkbox' || element.type === 'radio') return element.checked ? 'checked' : 'unchecked';
    return cleanText(element.value || '', 220);
  }

  function emitDetailStep(action, element, valueOverride) {
    if (!element || !element.tagName) return;
    var step = {
      action: action,
      label: getElementLabel(element),
      value: valueOverride !== undefined ? valueOverride : getElementValue(element),
      selector: getElementSelector(element),
      tagName: element.tagName.toLowerCase(),
      inputType: element.type || '',
      url: window.location.href,
    };

    sendLog({
      source: 'manual-step',
      detailStep: step,
      log: (action === 'click' ? 'Click' : 'Input') + (step.label ? ': ' + step.label : ''),
    });
  }

  var inputTimers = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest('button,a,input,textarea,select,[role="button"],[role="menuitem"],[data-testid]')
      : event.target;
    emitDetailStep('click', target, getElementValue(target));
  }, true);

  document.addEventListener('input', function (event) {
    var target = event.target;
    if (!target || !/input|textarea|select/i.test(target.tagName || '')) return;
    var send = function () { emitDetailStep('input', target, getElementValue(target)); };
    if (!inputTimers) return send();
    clearTimeout(inputTimers.get(target));
    inputTimers.set(target, setTimeout(send, 450));
  }, true);

  document.addEventListener('change', function (event) {
    var target = event.target;
    if (!target || !/input|textarea|select/i.test(target.tagName || '')) return;
    emitDetailStep('change', target, getElementValue(target));
  }, true);

  function serializeConsoleArgs(args) {
    return Array.prototype.slice.call(args).map(function (arg) {
      if (arg instanceof Error) {
        return { name: arg.name, message: arg.message, stack: truncate(arg.stack) };
      }
      if (arg && typeof arg === 'object') return truncate(redactObject(arg));
      return truncate(String(arg));
    }).join(' ');
  }

  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    console[level] = function () {
      var normalizedLevel = level === 'error' ? 'SEVERE' : level === 'warn' ? 'WARNING' : 'INFO';
      sendLog({ level: normalizedLevel, console: true, log: serializeConsoleArgs(arguments) });
      return originalConsole[level].apply(console, arguments);
    };
  });

  window.addEventListener('error', function (event) {
    sendLog({
      level: 'SEVERE',
      console: true,
      log: {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: truncate(event.error && event.error.stack),
      },
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    sendLog({
      level: 'SEVERE',
      console: true,
      log: {
        message: 'Unhandled promise rejection',
        reason: truncate(event.reason),
      },
    });
  });

  if (originalFetch) {
    window.fetch = function (input, init) {
      var startedAt = Date.now();
      var requestUrl = typeof input === 'string' ? input : input && input.url;
      var method = (init && init.method) || (input && input.method) || 'GET';
      var headers = headersToObject((init && init.headers) || (input && input.headers));
      var requestBody = init && init.body ? truncate(init.body) : undefined;
      var logUrl = compactNetworkUrl(requestUrl || '');

      return originalFetch(input, init).then(function (response) {
        var duration = Date.now() - startedAt;
        try {
          var emitNetworkLog = function (responseBody) {
            sendLog({
              log: 'Network Trace',
              network: {
                event: 'Response',
                method: method,
                url: logUrl || compactNetworkUrl(response.url),
                status: response.status,
                success: response.ok,
                duration: duration,
                headers: headersToObject(response.headers),
                data: {
                  requestHeaders: headers,
                  requestBody: requestBody,
                  responseBody: responseBody,
                },
              },
            });
          };

          if (shouldSkipNetworkBody(method, requestUrl || response.url)) {
            emitNetworkLog('[omitted: noisy/static/preflight network body]');
          } else {
            response.clone().text().then(function (text) {
              emitNetworkLog(truncate(text));
            }).catch(function () {});
          }
        } catch (_) {}
        return response;
      }).catch(function (error) {
        sendLog({
          log: 'Network Trace',
          network: {
            event: 'Error',
            method: method,
            url: logUrl || '',
            status: 0,
            success: false,
            duration: Date.now() - startedAt,
            headers: headers,
            data: { error: error && error.message ? error.message : String(error) },
          },
        });
        throw error;
      });
    };
  }

  if (originalXhrOpen && originalXhrSend) {
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__qaCapture = { method: method || 'GET', url: String(url || ''), startedAt: 0 };
      return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      var xhr = this;
      var meta = xhr.__qaCapture || { method: 'GET', url: '', startedAt: 0 };
      meta.startedAt = Date.now();
      xhr.addEventListener('loadend', function () {
        var responseBody = shouldSkipNetworkBody(meta.method, meta.url)
          ? '[omitted: noisy/static/preflight network body]'
          : truncate(xhr.responseText);
        sendLog({
          log: 'Network Trace',
          network: {
            event: 'Response',
            method: meta.method,
            url: compactNetworkUrl(meta.url),
            status: xhr.status,
            success: xhr.status >= 200 && xhr.status < 400,
            duration: Date.now() - meta.startedAt,
            headers: {},
            data: {
              requestBody: truncate(body),
              responseBody: responseBody,
            },
          },
        });
      });
      return originalXhrSend.apply(this, arguments);
    };
  }

  sendLog({
    level: 'INFO',
    console: true,
    log: 'Manual capture logger active',
  });
})();
