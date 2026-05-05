(function (globalScope) {
  'use strict';

  const MISSING_RECEIVER_ERRORS = [
    'Receiving end does not exist',
    'Could not establish connection',
    'The message port closed before a response was received',
  ];

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isTwitterTabUrl(url) {
    return /^https:\/\/(?:x|twitter)\.com\//i.test(url || '');
  }

  function isMissingReceiverError(error) {
    const message = error instanceof Error ? error.message : String(error || '');
    return MISSING_RECEIVER_ERRORS.some((fragment) => message.includes(fragment));
  }

  function sendTabMessage(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  async function injectCaptureAssets(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['interceptor.js'],
      world: 'MAIN',
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['shared.js'],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content.css'],
    });
  }

  async function ensureTwitterTabReady(tabId, options = {}) {
    const probeMessage = options.probeMessage || { type: 'PING' };
    const injectDelayMs = options.injectDelayMs ?? 150;
    const forceInject = options.forceInject === true;

    if (!forceInject) {
      try {
        const probe = await sendTabMessage(tabId, probeMessage);
        if (probe && probe.ready) {
          return { ready: true, injected: false };
        }
      } catch (error) {
        if (!isMissingReceiverError(error)) {
          throw error;
        }
      }
    }

    await injectCaptureAssets(tabId);
    await delay(injectDelayMs);

    const probe = await sendTabMessage(tabId, probeMessage);
    return { ready: !!(probe && probe.ready), injected: true };
  }

  function shouldHydrateCaptureData(input) {
    const hasCachedEntry = input?.hasCachedEntry === true;
    const lateBootstrap = input?.lateBootstrap === true;
    const data = input?.data || {};

    if (hasCachedEntry || !data.external_id) {
      return false;
    }

    if (lateBootstrap && (!data.conversation_id || !data.posted_at)) {
      return true;
    }

    if (data.source_type === 'article' && (!data.body_text || data.body_text.length < 500)) {
      return true;
    }

    return false;
  }

  globalScope.ScrollbackExtension = {
    ensureTwitterTabReady,
    injectCaptureAssets,
    isMissingReceiverError,
    isTwitterTabUrl,
    sendTabMessage,
    shouldHydrateCaptureData,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
