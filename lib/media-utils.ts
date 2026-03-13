/**
 * Optimize X (Twitter) CDN image URLs by appending format and size parameters.
 * If the URL is not from pbs.twimg.com, it is returned unchanged.
 */
export function optimizeXImageUrl(
  url: string,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  if (!url.includes('pbs.twimg.com')) return url;
  const base = url.split('?')[0];
  return `${base}?format=jpg&name=${size}`;
}
