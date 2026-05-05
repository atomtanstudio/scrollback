// ============================================================
// Scrollback - API Interceptor (runs in MAIN world / page context)
// ============================================================
// Patches the page's fetch() and XHR to intercept X's GraphQL API
// responses. Data is passed to the content script via CustomEvents.

(function () {
  'use strict';

  if (window.__feedsiloInterceptorInjected) {
    return;
  }
  window.__feedsiloInterceptorInjected = true;

  // Patch fetch()
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

      if (url.includes('/graphql/') || url.includes('/i/api/')) {
        const clone = response.clone();
        clone.json().then(data => {
          document.dispatchEvent(new CustomEvent('feedsilo-api-response', {
            detail: JSON.stringify(data),
          }));
        }).catch(() => {});
      }
    } catch {
      // Never break the page
    }

    return response;
  };

  // Patch XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._fsUrl = url;
    return originalXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (this._fsUrl && (this._fsUrl.includes('/graphql/') || this._fsUrl.includes('/i/api/'))) {
      this.addEventListener('load', function () {
        try {
          const data = JSON.parse(this.responseText);
          document.dispatchEvent(new CustomEvent('feedsilo-api-response', {
            detail: JSON.stringify(data),
          }));
        } catch {}
      });
    }
    return originalXHRSend.apply(this, args);
  };
})();
