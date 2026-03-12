// ============================================================
// BaseX - API Interceptor (runs in MAIN world / page context)
// ============================================================
// This script patches the page's actual fetch() and XHR to intercept
// X's GraphQL API responses. Data is passed to the content script
// via CustomEvents on the document.

(function () {
  'use strict';

  console.log('BaseX: interceptor loaded in MAIN world at', document.readyState);

  // Debug helper: check for content_state entity data in raw API response
  function debugContentState(data, source) {
    if (!data || typeof data !== 'object') return;
    if (data.content_state?.entityMap) {
      const em = data.content_state.entityMap;
      const keys = Object.keys(em);
      if (keys.length > 0) {
        console.log('BaseX MAIN: Found entityMap in', source, 'with', keys.length, 'entities');
        for (const k of keys.slice(0, 3)) {
          console.log('BaseX MAIN: entity[' + k + '] =', JSON.stringify(em[k]).substring(0, 500));
        }
      }
    }
    // Recurse one level into article_results
    if (data.article?.article_results?.result?.content_state?.entityMap) {
      const em = data.article.article_results.result.content_state.entityMap;
      const keys = Object.keys(em);
      console.log('BaseX MAIN: Found article entityMap in', source, 'with', keys.length, 'entities');
      for (const k of keys.slice(0, 3)) {
        console.log('BaseX MAIN: article entity[' + k + '] =', JSON.stringify(em[k]).substring(0, 500));
      }
    }
  }

  // Patch fetch()
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

      if (url.includes('/graphql/') || url.includes('/i/api/')) {
        const clone = response.clone();
        clone.json().then(data => {
          // Debug: check entity data before serialization
          debugContentState(data, 'fetch:' + url.split('/').pop());
          // Send to content script via custom event
          document.dispatchEvent(new CustomEvent('basex-api-response', {
            detail: JSON.stringify(data),
          }));
        }).catch(() => {});
      }
    } catch (e) {
      // Never break the page
    }

    return response;
  };

  // Patch XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._basexUrl = url;
    return originalXHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (this._basexUrl && (this._basexUrl.includes('/graphql/') || this._basexUrl.includes('/i/api/'))) {
      this.addEventListener('load', function () {
        try {
          const data = JSON.parse(this.responseText);
          // Debug: check entity data before serialization
          debugContentState(data, 'xhr:' + (this._basexUrl || '').split('/').pop());
          document.dispatchEvent(new CustomEvent('basex-api-response', {
            detail: JSON.stringify(data),
          }));
        } catch (e) {}
      });
    }
    return originalXHRSend.apply(this, args);
  };
})();
