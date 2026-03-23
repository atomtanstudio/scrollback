// FeedSilo Extension - Background Service Worker
// Relays captured tweet data from content script to FeedSilo server.

importScripts('shared.js');

const { ensureTwitterTabReady, isTwitterTabUrl } = self.FeedSiloExtension;

// Keep service worker alive — MV3 workers go to sleep after ~30s of inactivity.
// A periodic alarm wakes it up to prevent stale connections with content scripts.
chrome.alarms.create('keepalive', { periodInMinutes: 0.4 }); // ~24 seconds
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    // No-op — the alarm firing is enough to keep the worker alive
  }
});

// Re-attach capture scripts to already-open X/Twitter tabs.
// This covers extension reload/update without forcing a page reload.
async function ensureExistingTwitterTabsReady() {
  try {
    const tabs = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await ensureTwitterTabReady(tab.id);
      } catch {
        // Tab might be mid-navigation or restricted — ignore
      }
    }
  } catch {
    // No tabs or permission issue — ignore
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureExistingTwitterTabsReady();
});

chrome.runtime.onStartup.addListener(() => {
  ensureExistingTwitterTabsReady();
});

ensureExistingTwitterTabsReady();

// Track pending thread fetches: backgroundTabId → { originTabId, conversationId, resolve, timer }
const pendingThreadFetches = new Map();

// Dedup: conversationId → Promise (reuse in-flight fetch for same conversation)
const inflight = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_TWEET') {
    handleSingleCapture(message.data).then(sendResponse);
    return true; // Keep channel open for async
  }

  if (message.type === 'CAPTURE_BULK') {
    handleBulkCapture(message.items).then(sendResponse);
    return true;
  }

  if (message.type === 'RESOLVE_MEDIA') {
    resolveMissingMedia(message.data).then(() => sendResponse({ success: true, media_urls: message.data.media_urls || [] }));
    return true;
  }

  if (message.type === 'CAPTURE_BULK_VIA_API') {
    handleBulkCaptureViaApi(message.tweetIds).then(sendResponse);
    return true;
  }

  if (message.type === 'CHECK_CONNECTION') {
    handleCheckConnection().then(sendResponse);
    return true;
  }

  if (message.type === 'FETCH_THREAD') {
    const originTabId = sender.tab?.id;
    if (!originTabId) {
      sendResponse({ success: false, tweets: [] });
      return;
    }
    if (!message.url || !message.conversationId) {
      sendResponse({ success: false, tweets: [] });
      return;
    }
    handleFetchThread(message.url, message.conversationId, originTabId).then(sendResponse);
    return true;
  }

  if (message.type === 'THREAD_DATA_READY') {
    const bgTabId = sender.tab?.id;
    const pending = pendingThreadFetches.get(bgTabId);
    if (pending) {
      // Forward tweets to the originating tab
      chrome.tabs.sendMessage(pending.originTabId, {
        type: 'MERGE_CACHE',
        tweets: message.tweets || [],
      }).catch(() => {});
      // resolve() handles timeout clear, map cleanup, and window close
      pending.resolve({ success: true, tweets: message.tweets || [] });
    }
    return;
  }
});

async function getSettings() {
  return new Promise((resolve) => {
    const keys = ['serverUrl', 'captureSecret', 'bearerToken'];
    chrome.storage.local.get(keys, (localResult) => {
      chrome.storage.sync.get(keys, (syncResult) => {
        const merged = { ...syncResult, ...localResult };
        if (keys.some((key) => syncResult[key])) {
          chrome.storage.local.set(merged, () => {
            chrome.storage.sync.remove(keys, () => resolve(merged));
          });
          return;
        }
        resolve(merged);
      });
    });
  });
}

async function resolveVideoUrls(data) {
  // If media_urls contains video thumbnails but no mp4s, fetch from syndication API
  const hasVideo = data._hasUnresolvedVideo ||
    (data.media_urls || []).some(u => u.includes('video_thumb'));
  if (!hasVideo) return;

  const tweetId = data.external_id;
  if (!tweetId) return;

  try {
    const resp = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=x`
    );
    if (!resp.ok) return;
    const syndicationData = await resp.json();

    const allMedia = [...(syndicationData.mediaDetails || [])];
    if (syndicationData.quoted_tweet?.mediaDetails) {
      allMedia.push(...syndicationData.quoted_tweet.mediaDetails);
    }

    const videoUrls = [];
    for (const md of allMedia) {
      if (md.type !== 'video' && md.type !== 'animated_gif') continue;
      const variants = md.video_info?.variants || [];
      const mp4s = variants.filter(v => v.content_type === 'video/mp4' && v.url);
      if (mp4s.length > 0) {
        mp4s.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        videoUrls.push(mp4s[0].url);
      }
    }

    if (videoUrls.length > 0) {
      // Remove thumbnail URLs, add real video URLs
      data.media_urls = (data.media_urls || []).filter(u => !u.includes('video_thumb'));
      data.media_urls.push(...videoUrls);
    }
  } catch (e) {
    console.warn('FeedSilo: syndication resolve failed', e instanceof Error ? e.message : 'Unknown error');
  }

  // Clean internal flag before sending to server
  delete data._hasUnresolvedVideo;
}

async function resolveArticleContent(data) {
  const tweetId = data.external_id;
  if (!tweetId) return;

  const bodyText = (data.body_text || '').trim();
  const bodyIsEmpty = !bodyText || /^https?:\/\/t\.co\/\w+$/.test(bodyText);

  // Call syndication if: body is empty/URL, OR source_type is article (to fix title), OR source_type unknown
  const needsSyndication = bodyIsEmpty || data.source_type === 'article' || !data.source_type;
  if (!needsSyndication) return;

  try {
    const resp = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=x`
    );
    if (!resp.ok) return;
    const syndicationData = await resp.json();

    const article = syndicationData.article;
    if (article) {
      data.source_type = 'article';
      if (article.title) data.title = article.title;
      if (article.preview_text && bodyIsEmpty) data.body_text = article.preview_text;
    }
  } catch (e) {
    console.warn('FeedSilo: article resolve failed', e instanceof Error ? e.message : 'Unknown error');
  }
}

async function resolveMissingMedia(data) {
  // If tweet has no media_urls, try syndication API to fetch them
  if (data.media_urls && data.media_urls.length > 0) return;
  const tweetId = data.external_id;
  if (!tweetId) return;

  try {
    const resp = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=x`
    );
    if (!resp.ok) return;
    const syndicationData = await resp.json();

    const allMedia = [...(syndicationData.mediaDetails || [])];
    if (syndicationData.quoted_tweet?.mediaDetails) {
      allMedia.push(...syndicationData.quoted_tweet.mediaDetails);
    }

    const mediaUrls = [];
    for (const md of allMedia) {
      if (md.type === 'video' || md.type === 'animated_gif') {
        const variants = md.video_info?.variants || [];
        const mp4s = variants.filter(v => v.content_type === 'video/mp4' && v.url);
        if (mp4s.length > 0) {
          mp4s.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          mediaUrls.push(mp4s[0].url);
        }
      } else if (md.media_url_https) {
        mediaUrls.push(md.media_url_https);
      }
    }

    // Also check for link card preview image (Twitter Card / Open Graph)
    if (mediaUrls.length === 0) {
      const cardUrl =
        syndicationData.card?.binding_values?.thumbnail_image_original?.image_value?.url
        || syndicationData.card?.binding_values?.thumbnail_image?.image_value?.url
        || syndicationData.card?.binding_values?.summary_photo_image_original?.image_value?.url
        || syndicationData.card?.binding_values?.summary_photo_image?.image_value?.url
        || syndicationData.card?.binding_values?.player_image_original?.image_value?.url
        || syndicationData.card?.binding_values?.player_image?.image_value?.url;
      if (cardUrl) {
        mediaUrls.push(cardUrl);
      }
    }

    if (mediaUrls.length > 0) {
      data.media_urls = mediaUrls;
    }
  } catch (e) {
    // Silently ignore — media is optional
  }
}

async function handleSingleCapture(data) {
  await resolveVideoUrls(data);
  await resolveArticleContent(data);
  await resolveMissingMedia(data);

  const settings = await getSettings();
  if (!settings.serverUrl || !settings.captureSecret) {
    return { success: false, error: 'Extension not configured. Open popup to set server URL and secret.' };
  }

  try {
    const response = await fetch(`${settings.serverUrl}/api/extension/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.captureSecret}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      const payload = await response.json().catch(() => null);
      if (payload?.error) {
        message += `: ${payload.error}`;
      }
      throw new Error(message);
    }

    return await response.json();
  } catch (error) {
    console.error('FeedSilo capture error:', error instanceof Error ? error.message : 'Unknown error');
    return { success: false, error: error instanceof Error ? error.message : 'Capture failed' };
  }
}

async function handleBulkCapture(items) {
  for (const item of items) {
    await resolveVideoUrls(item);
    await resolveArticleContent(item);
    await resolveMissingMedia(item);
  }

  const settings = await getSettings();
  if (!settings.serverUrl || !settings.captureSecret) {
    return { success: false, error: 'Extension not configured.' };
  }

  try {
    const response = await fetch(`${settings.serverUrl}/api/extension/capture/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.captureSecret}`,
      },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      const payload = await response.json().catch(() => null);
      if (payload?.error) {
        message += `: ${payload.error}`;
      }
      throw new Error(message);
    }

    return await response.json();
  } catch (error) {
    console.error('FeedSilo bulk capture error:', error instanceof Error ? error.message : 'Unknown error');
    return { success: false, error: error instanceof Error ? error.message : 'Bulk capture failed' };
  }
}

async function handleBulkCaptureViaApi(tweetIds) {
  const settings = await getSettings();
  if (!settings.serverUrl || !settings.captureSecret) {
    return { success: false, error: 'Extension not configured.' };
  }

  try {
    const response = await fetch(`${settings.serverUrl}/api/xapi/fetch-tweets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.captureSecret}`,
      },
      body: JSON.stringify({ tweetIds }),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      const payload = await response.json().catch(() => null);
      if (payload?.error) {
        message += `: ${payload.error}`;
      }
      throw new Error(message);
    }

    return await response.json();
  } catch (error) {
    console.error('FeedSilo API bulk capture error:', error instanceof Error ? error.message : 'Unknown error');
    return { success: false, error: error instanceof Error ? error.message : 'Bulk capture failed' };
  }
}

async function handleCheckConnection() {
  const settings = await getSettings();
  if (!settings.serverUrl || !settings.captureSecret) {
    return { success: false, error: 'Not configured' };
  }

  try {
    const response = await fetch(`${settings.serverUrl}/api/extension/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.captureSecret}`,
      },
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
  }
}

async function handleFetchThread(url, conversationId, originTabId) {
  if (inflight.has(conversationId)) {
    return inflight.get(conversationId);
  }

  const promise = new Promise((resolve) => {
    // Open in a minimized window so it never appears in the user's tab bar
    chrome.windows.create({ url, state: 'minimized', focused: false }, (win) => {
      const tab = win?.tabs?.[0];
      if (chrome.runtime.lastError || !tab?.id) {
        inflight.delete(conversationId);
        resolve({ success: false, tweets: [] });
        return;
      }

      const winId = win.id;

      // Declare listener before the timeout so both can reference it
      let listener;

      const cleanup = () => {
        chrome.tabs.onUpdated.removeListener(listener);
        pendingThreadFetches.delete(tab.id);
        chrome.windows.remove(winId).catch(() => {});
        inflight.delete(conversationId);
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve({ success: false, tweets: [], timeout: true });
      }, 8000);

      pendingThreadFetches.set(tab.id, {
        originTabId,
        conversationId,
        resolve: (result) => {
          clearTimeout(timer);
          cleanup();
          resolve(result);
        },
        timer,
      });

      // Tell the new tab it's a background fetch once it's ready
      listener = async function (tabId, changeInfo, updatedTab) {
        if (tabId !== tab.id || changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(listener);
        try {
          if (isTwitterTabUrl(updatedTab?.url || tab.url)) {
            await ensureTwitterTabReady(tab.id, { injectDelayMs: 250 });
          }
          chrome.tabs.sendMessage(tab.id, {
            type: 'BG_FETCH_INIT',
            conversationId,
          }).catch(() => {});
        } catch {
          // If the helper cannot attach, let the normal timeout clean up.
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });

  inflight.set(conversationId, promise);
  return promise;
}
