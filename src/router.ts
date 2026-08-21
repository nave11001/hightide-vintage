import { useEffect, useState } from 'react';

// The shop has two addresses: the shop itself, and one garment.
//
// That is the whole routing requirement, and it is why there is no router
// library here. react-router would add about 8KB gzipped to serve a table of
// two rows, and would want to own the tree it is mounted in. The History API
// already does this; it just needs somewhere to keep the current path.

/** The path the browser is on, kept in sync with back, forward and pushState. */
export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    // pushState and replaceState fire no event of their own, so navigate()
    // below announces itself and every listener hears it.
    window.addEventListener('hightide:navigate', sync);
    // A path that changed between first render and this effect — a redirect
    // during startup, say — would otherwise be missed entirely.
    sync();
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hightide:navigate', sync);
    };
  }, []);

  return path;
}

/**
 * Go to a path without reloading.
 *
 * `replace` rewrites the current entry instead of adding one — for turning a
 * link the visitor did not type, like the bot's ?item=, into the canonical
 * address. Pressing back should return them to wherever they came from, not to
 * the same page under its old name.
 */
export function navigate(path: string, options: { replace?: boolean } = {}) {
  const current = window.location.pathname + window.location.search;
  if (path === current) return;

  // Only a pushed entry is stamped, and the stamp means "there is somewhere of
  // ours behind this". A replaced entry sits on top of wherever the visitor
  // arrived from, so going back would take them off the site entirely — which
  // is why closing a garment consults this rather than always calling back().
  if (options.replace) window.history.replaceState({}, '', path);
  else window.history.pushState({ hightide: true }, '', path);

  window.dispatchEvent(new Event('hightide:navigate'));
}

/** The slug in /product/<slug>, or null anywhere else. */
export function productSlugFromPath(path: string): string | null {
  const match = /^\/product\/([^/]+)\/?$/.exec(path);
  return match ? decodeURIComponent(match[1]) : null;
}
