document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const captureSecretInput = document.getElementById('captureSecret');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const bulkBtn = document.getElementById('bulkBtn');
  const statusMsg = document.getElementById('statusMsg');
  const connectionDot = document.getElementById('connectionDot');

  // Load saved settings
  chrome.storage.sync.get(['serverUrl', 'captureSecret'], (result) => {
    if (result.serverUrl) serverUrlInput.value = result.serverUrl;
    if (result.captureSecret) captureSecretInput.value = result.captureSecret;

    if (result.serverUrl && result.captureSecret) {
      testConnection();
    }
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const url = serverUrlInput.value.trim().replace(/\/+$/, ''); // Strip trailing slash
    const secret = captureSecretInput.value.trim();

    if (!url) {
      showStatus('Enter a server URL', 'error');
      return;
    }

    chrome.storage.sync.set({ serverUrl: url, captureSecret: secret }, () => {
      showStatus('Settings saved', 'success');
      if (url && secret) testConnection();
    });
  });

  // Test connection
  testBtn.addEventListener('click', testConnection);

  function testConnection() {
    showStatus('Connecting...', 'info');
    connectionDot.className = 'connection-dot offline';

    chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' }, (response) => {
      if (response && response.success) {
        connectionDot.className = 'connection-dot online';
        showStatus('Connected', 'success');
      } else {
        connectionDot.className = 'connection-dot error';
        showStatus(response?.error || 'Connection failed', 'error');
      }
    });
  }

  // Bulk capture - send message to content script
  bulkBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url?.includes('x.com') && !tab?.url?.includes('twitter.com')) {
        showStatus('Navigate to x.com first', 'error');
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: 'START_BULK_CAPTURE' }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Reload the X page and try again', 'error');
          return;
        }
        showStatus('Bulk capture started', 'success');
        window.close(); // Close popup so user can see the page
      });
    });
  });

  function showStatus(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = `status-msg ${type}`;
  }
});
