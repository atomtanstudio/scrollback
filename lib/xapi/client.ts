import { loadTokens, storeTokens } from "./token-store";
import { refreshAccessToken } from "./oauth";

const BASE_URL = "https://api.x.com/2";

const TWEET_FIELDS = "created_at,public_metrics,conversation_id,entities,note_tweet,attachments";
const USER_FIELDS = "name,username,profile_image_url";
const MEDIA_FIELDS = "url,preview_image_url,type,variants,alt_text";
const EXPANSIONS = "author_id,attachments.media_keys";

async function getAccessToken(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error("No X API connection. Connect via Settings.");

  // Refresh if expired or expiring within 5 minutes
  if (tokens.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const clientId = process.env.XAPI_CLIENT_ID;
    const clientSecret = process.env.XAPI_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("XAPI_CLIENT_ID/SECRET not set");

    const refreshed = await refreshAccessToken({
      refreshToken: tokens.refreshToken,
      clientId,
      clientSecret,
    });

    await storeTokens({
      xUserId: tokens.xUserId,
      xUsername: tokens.xUsername,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      scopes: "tweet.read users.read bookmark.read like.read offline.access",
    });

    return refreshed.access_token;
  }

  return tokens.accessToken;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function xApiFetch(path: string, params?: Record<string, string>): Promise<any> {
  const token = await getAccessToken();
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`X API error: ${resp.status} ${text}`);
  }

  return resp.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchBookmarks(paginationToken?: string): Promise<any> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error("Not connected");

  const params: Record<string, string> = {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    expansions: EXPANSIONS,
    max_results: "100",
  };
  if (paginationToken) params.pagination_token = paginationToken;

  return xApiFetch(`/users/${tokens.xUserId}/bookmarks`, params);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchLikedTweets(paginationToken?: string): Promise<any> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error("Not connected");

  const params: Record<string, string> = {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    expansions: EXPANSIONS,
    max_results: "100",
  };
  if (paginationToken) params.pagination_token = paginationToken;

  return xApiFetch(`/users/${tokens.xUserId}/liked_tweets`, params);
}

// Fetch current user info (for getting user ID after OAuth)
export async function fetchMe(accessToken: string): Promise<{ id: string; username: string; name: string }> {
  const resp = await fetch(`${BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`X API /users/me error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  return data.data;
}
