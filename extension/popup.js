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
  const recaptureThreadsBtn = document.getElementById('recaptureThreadsBtn');
  const statusMsg = document.getElementById('statusMsg');
  const xapiStatusMsg = document.getElementById('xapiStatusMsg');
  const repairStatusMsg = document.getElementById('repairStatusMsg');
  const connectionDot = document.getElementById('connectionDot');
  const connectionStatus = document.getElementById('connectionStatus');
  const connectionLabel = document.getElementById('connectionLabel');
  const xapiBadge = document.getElementById('xapiBadge');
  const captureModeText = document.getElementById('captureModeText');

  bootstrapActiveTwitterTab();
  refreshRepairQueueStatus();

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
  saveBtn.addEventListener('click', async () => {
    const url = serverUrlInput.value.trim().replace(/\/+$/, '');
    const secret = captureSecretInput.value.trim();

    if (!url) {
      showStatus(statusMsg, 'Enter a server URL', 'error');
      return;
    }

    // Request host permission for the user's server URL
    try {
      const origin = new URL(url).origin + '/*';
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) {
        showStatus(statusMsg, 'Permission denied — extension needs access to your server', 'error');
        return;
      }
    } catch {
      showStatus(statusMsg, 'Invalid server URL', 'error');
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
        const user = response.user;
        const label = user ? `${user.email} (${user.role})` : 'Connected';
        updateConnectionState('online', 'Connected');
        connectionStatus.title = label;
        showStatus(statusMsg, label, 'success');
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

      // Also save to Scrollback server if connected
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

  recaptureThreadsBtn.addEventListener('click', () => {
    recaptureThreadsBtn.disabled = true;
    showStatus(repairStatusMsg, 'Recapturing singleton threads...', 'info');

    chrome.runtime.sendMessage({ type: 'RECAPTURE_SINGLETON_THREADS', limit: 5 }, (response) => {
      recaptureThreadsBtn.disabled = false;

      if (chrome.runtime.lastError) {
        showStatus(repairStatusMsg, chrome.runtime.lastError.message || 'Recapture failed', 'error');
        return;
      }

      if (!response?.success) {
        showStatus(repairStatusMsg, response?.error || 'Recapture failed', 'error');
        return;
      }

      const remaining = response.remainingAfter === null || response.remainingAfter === undefined
        ? 'unknown remaining'
        : `${response.remainingAfter} remaining`;
      const message = `Queued ${response.queued || 0}, recaptured ${response.recaptured || 0}, skipped ${response.skipped || 0}, errors ${response.errors || 0}; ${remaining}`;
      showStatus(repairStatusMsg, message, response.errors ? 'error' : 'success');
      if (response.remainingAfter !== null && response.remainingAfter !== undefined) {
        recaptureThreadsBtn.textContent = response.remainingAfter > 0
          ? `Recapture 5 of ${response.remainingAfter} singleton threads`
          : 'No singleton threads left';
        recaptureThreadsBtn.disabled = response.remainingAfter === 0;
      }
      console.log('Scrollback thread recapture summary', response);
    });
  });

  function refreshRepairQueueStatus() {
    if (!recaptureThreadsBtn || !repairStatusMsg) return;
    chrome.runtime.sendMessage({ type: 'GET_SINGLETON_THREAD_QUEUE', limit: 5 }, (response) => {
      if (chrome.runtime.lastError || !response?.success) return;
      const remaining = response.remaining || 0;
      recaptureThreadsBtn.textContent = remaining > 0
        ? `Recapture 5 of ${remaining} singleton threads`
        : 'No singleton threads left';
      recaptureThreadsBtn.disabled = remaining === 0;
      showStatus(repairStatusMsg, remaining > 0
        ? `${remaining} singleton thread captures left to check.`
        : 'No singleton thread captures left to check.',
      remaining > 0 ? 'info' : 'success');
    });
  }

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
