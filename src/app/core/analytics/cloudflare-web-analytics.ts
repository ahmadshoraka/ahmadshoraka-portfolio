/**
 * Installs the Cloudflare Web Analytics beacon when a site token is provided.
 *
 * Safe to call when Cloudflare Pages already auto-injects the script: this
 * helper skips installation if a beacon is already present on the page.
 * SPA route changes are tracked by the beacon by default.
 */
export function installCloudflareWebAnalytics(token: string | undefined | null): void {
  if (typeof document === 'undefined') {
    return;
  }

  const trimmed = token?.trim();
  if (!trimmed) {
    return;
  }

  const alreadyLoaded = document.querySelector(
    'script[src*="cloudflareinsights.com/beacon"], script[data-cf-beacon]',
  );
  if (alreadyLoaded) {
    return;
  }

  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute(
    'data-cf-beacon',
    JSON.stringify({
      token: trimmed,
      spa: true,
    }),
  );
  document.body.appendChild(script);
}
