// BaseX Extension - Background Service Worker
// Relays captured tweet data from content script to BaseX server.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_TWEET') {
    handleSingleCapture(message.data).then(sendResponse);
    return true; // Keep channel open for async
  }

  if (message.type === 'CAPTURE_BULK') {
    handleBulkCapture(message.items).then(sendResponse);
    return true;
  }

  if (message.type === 'CHECK_CONNECTION') {
    handleCheckConnection().then(sendResponse);
    return true;
  }
});

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['serverUrl', 'captureSecret'], resolve);
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
    console.warn('BaseX: syndication resolve failed', e);
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
    if (!resp.ok) {
      console.warn('BaseX: syndication API returned', resp.status, 'for', tweetId);
      return;
    }
    const syndicationData = await resp.json();

    const article = syndicationData.article;
    if (article) {
      data.source_type = 'article';
      // Always set title from syndication — it's the canonical source
      if (article.title) {
        console.log('BaseX: setting article title:', JSON.stringify(article.title), '(was:', JSON.stringify(data.title), ')');
        data.title = article.title;
      }
      // Fill body if empty or just a URL
      if (article.preview_text && bodyIsEmpty) {
        data.body_text = article.preview_text;
      }
      console.log('BaseX: resolved article content | title:', data.title, '| body:', data.body_text?.length, 'chars');
    }
  } catch (e) {
    console.warn('BaseX: article resolve failed', e);
  }
}

async function handleSingleCapture(data) {
  await resolveVideoUrls(data);
  await resolveArticleContent(data);

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
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return await response.json();
  } catch (error) {
    console.error('BaseX capture error:', error);
    return { success: false, error: error.message };
  }
}

async function handleBulkCapture(items) {
  for (const item of items) {
    await resolveVideoUrls(item);
    await resolveArticleContent(item);
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
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return await response.json();
  } catch (error) {
    console.error('BaseX bulk capture error:', error);
    return { success: false, error: error.message };
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
    return { success: false, error: error.message };
  }
}
