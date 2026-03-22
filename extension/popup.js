document.addEventListener('DOMContentLoaded', () => {
  const { ensureTwitterTabReady, isTwitterTabUrl, sendTabMessage } = globalThis.FeedSiloExtension || {};
  const STORAGE_KEYS = ['serverUrl', 'captureSecret', 'bearerToken'];
  const serverUrlInput = document.getElementById('serverUrl');
  const captureSecretInput = document.getElementById('captureSecret');
  const bearerTokenInput = document.getElementById('bearerToken');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const saveXapiBtn = document.getElementById('saveXapiBtn');
  const bulkBtn = document.getElementById('bulkBtn');
  const statusMsg = document.getElementById('statusMsg');
  const xapiStatusMsg = document.getElementById('xapiStatusMsg');
  const connectionDot = document.getElementById('connectionDot');
  const connectionStatus = document.getElementById('connectionStatus');
  const connectionLabel = document.getElementById('connectionLabel');
  const xapiBadge = document.getElementById('xapiBadge');
  const captureModeText = document.getElementById('captureModeText');

  bootstrapActiveTwitterTab();

  // Load saved settings
  loadSettings((result) => {
    if (result.serverUrl) serverUrlInput.value = result.serverUrl;
    if (result.captureSecret) captureSecretInput.value = result.captureSecret;
    if (result.bearerToken) {
      bearerTokenInput.value = result.bearerToken;
      xapiBadge.textContent = 'Active';
      xapiBadge.className = 'badge badge-active';
      updateCaptureMode(true);
    }

    if (result.serverUrl && result.captureSecret) {
      testConnection();
    }
  });

  // Save connection settings
  saveBtn.addEventListener('click', () => {
    const url = serverUrlInput.value.trim().replace(/\/+$/, '');
    const secret = captureSecretInput.value.trim();

    if (!url) {
      showStatus(statusMsg, 'Enter a server URL', 'error');
      return;
    }

    saveSettings({ serverUrl: url, captureSecret: secret }, () => {
      showStatus(statusMsg, 'Settings saved', 'success');
      if (url && secret) testConnection();
    });
  });

  // Test connection
  testBtn.addEventListener('click', testConnection);

  function testConnection() {
    showStatus(statusMsg, 'Connecting...', 'info');
    updateConnectionState('offline', 'Checking');
    connectionStatus.title = 'Connecting...';

    chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' }, (response) => {
      if (response && response.success) {
        updateConnectionState('online', 'Connected');
        connectionStatus.title = 'Connected';
        showStatus(statusMsg, 'Connected', 'success');
      } else {
        updateConnectionState('error', 'Failed');
        connectionStatus.title = 'Connection failed';
        showStatus(statusMsg, response?.error || 'Connection failed', 'error');
      }
    });
  }

  // Save X API bearer token
  saveXapiBtn.addEventListener('click', () => {
    const token = bearerTokenInput.value.trim();
    if (!token) {
      showStatus(xapiStatusMsg, 'Enter a bearer token', 'error');
      return;
    }

    saveSettings({ bearerToken: token }, () => {
      showStatus(xapiStatusMsg, 'Token saved', 'success');
      xapiBadge.textContent = 'Active';
      xapiBadge.className = 'badge badge-active';
      updateCaptureMode(true);

      // Also save to FeedSilo server if connected
      const serverUrl = serverUrlInput.value.trim().replace(/\/+$/, '');
      const secret = captureSecretInput.value.trim();
      if (serverUrl && secret) {
        fetch(`${serverUrl}/api/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`,
          },
          body: JSON.stringify({ xapi: { bearerToken: token } }),
        }).catch(() => {
          // Non-fatal — token is saved locally regardless
        });
      }
    });
  });

  // Bulk capture
  bulkBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!ensureTwitterTabReady || !isTwitterTabUrl || !sendTabMessage) {
        showStatus(statusMsg, 'Extension bootstrap unavailable', 'error');
        return;
      }

      if (!isTwitterTabUrl(tab?.url)) {
        showStatus(statusMsg, 'Navigate to x.com first', 'error');
        return;
      }

      const useApi = !!bearerTokenInput.value.trim();
      try {
        await ensureTwitterTabReady(tab.id);
        await sendTabMessage(tab.id, { type: 'START_BULK_CAPTURE', useApi });
        showStatus(statusMsg, `Bulk capture started${useApi ? ' (API mode)' : ''}`, 'success');
        window.close();
      } catch (error) {
        showStatus(statusMsg, error instanceof Error ? error.message : 'Unable to initialize X tab', 'error');
      }
    });
  });

  function updateCaptureMode(hasToken) {
    if (hasToken) {
      captureModeText.textContent = 'X API mode';
      captureModeText.className = 'capture-mode-text api-mode';
    } else {
      captureModeText.textContent = 'Page scraping mode';
      captureModeText.className = 'capture-mode-text';
    }
  }

  function updateConnectionState(state, label) {
    connectionDot.className = `connection-dot ${state}`;
    connectionStatus.className = `connection-status ${state}`;
    connectionLabel.textContent = label;
  }

  function showStatus(el, text, type) {
    el.textContent = text;
    el.className = `status-msg ${type}`;
  }

  function bootstrapActiveTwitterTab() {
    if (!ensureTwitterTabReady || !isTwitterTabUrl) return;

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !isTwitterTabUrl(tab.url)) return;

      try {
        await ensureTwitterTabReady(tab.id);
      } catch {
        // Best effort only — explicit actions will surface errors.
      }
    });
  }

  function loadSettings(callback) {
    chrome.storage.local.get(STORAGE_KEYS, (localResult) => {
      chrome.storage.sync.get(STORAGE_KEYS, (syncResult) => {
        const merged = { ...syncResult, ...localResult };
        if (STORAGE_KEYS.some((key) => syncResult[key])) {
          chrome.storage.local.set(merged, () => {
            chrome.storage.sync.remove(STORAGE_KEYS, () => callback(merged));
          });
          return;
        }
        callback(merged);
      });
    });
  }

  function saveSettings(values, callback) {
    chrome.storage.local.set(values, () => {
      chrome.storage.sync.remove(Object.keys(values), () => {
        if (callback) callback();
      });
    });
  }
});
