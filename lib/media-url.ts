/**
 * Resolve a media item's display URL.
 *
 * - If stored_path is an R2 key (doesn't start with http), route through proxy
 * - If stored_path is a full URL (legacy), use directly
 * - Otherwise fall back to original_url
 */
export function getMediaDisplayUrl(storedPath: string | null, originalUrl: string): string {
  if (storedPath) {
    if (storedPath.startsWith("http")) return storedPath;
    if (storedPath.startsWith("local/")) return `/api/local-media/${storedPath.slice(6)}`;
    // Strip leading ./ if present (legacy basex paths)
    const clean = storedPath.replace(/^\.\//, "");
    return `/api/r2/${clean}`;
  }
  return originalUrl;
}
