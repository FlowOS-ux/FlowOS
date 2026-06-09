/**
 * FlowOS mobile - src/lib/images.ts
 * Image helpers. Uses a business's own logo when set, otherwise a stable,
 * deterministic placeholder photo (same business -> same image).
 */
import type { Business } from '../api/types';
import { MEDIA_BASE_URL } from '../config';

// Local hosts that may be baked into legacy stored image URLs; rewritten to the
// current media origin so old data still loads on other devices/networks.
const LOCAL_HOST_UPLOAD = /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+)(?::\d+)?(\/uploads\/.*)$/i;

/**
 * Resolve a stored image reference to a loadable absolute URL:
 *  - external http(s) URLs (e.g. Unsplash) are returned unchanged
 *  - relative "/uploads/..." paths are prefixed with the current media origin
 *  - legacy absolute URLs pointing at a local host are rewritten to that origin
 */
export function resolveMediaUri(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const legacy = url.match(LOCAL_HOST_UPLOAD);
  if (legacy) return `${MEDIA_BASE_URL}${legacy[1]}`;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${MEDIA_BASE_URL}${url}`;
  return url;
}

export function businessImageUrl(
  b: Pick<Business, 'id' | 'logoUrl'>,
  width = 600,
  height = 300,
): string {
  const resolved = resolveMediaUri(b.logoUrl);
  if (resolved) return resolved;
  return `https://picsum.photos/seed/flowos-${b.id}/${width}/${height}`;
}
